import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createBinaryAssetsPlugin } from './index';

const SOURCE = `8f4e/v1
note config
; @config bin.sound.url https://example.com/sample.pcm
; @config bin.sound.memory player:buffer
noteEnd
entry main
module player
int[] buffer 4
moduleEnd
module preview
int[] buffer 4
moduleEnd
entryEnd`;

const cleanups: Array<() => void> = [];
const fetchMock = vi.fn<typeof fetch>();

async function setup({ source = SOURCE, installed = true, withMemory = true, compile = true } = {}) {
	const events = createEvents();
	const store = initState(events, {
		callbacks: {},
	});
	events.dispatch('enterEditMode');
	const memory = new Uint8Array(65536);
	const getMemoryBytes = vi.fn<() => Uint8Array | undefined>(() => (withMemory ? memory : undefined));
	const disposePlugin = installed
		? createBinaryAssetsPlugin({ getMemoryBytes }).setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
				drawers: createEditorDrawerRegistry(),
			})
		: () => {};
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	const project = parseProjectSource(source);
	events.dispatch('loadProject', { project });
	events.dispatch('enterEditMode');
	if (compile) {
		const compiled = await compileProject(project);
		store.set('compiler.result.compiledModules', compiled.compiledModules);
		store.set('compiler.result.compiledFunctions', compiled.compiledFunctions);
		store.set('compiler.result.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		store.set('compiler.result.projectMemoryExposuresByGroupPath', compiled.projectMemoryExposuresByGroupPath);
		store.set('compiler.result.memoryPlan', compiled.memoryPlan);
	}
	const state = store.getState();
	const env = () => state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'env')!;
	const editConfig = (update: (code: string[]) => string[]) => {
		const codeBlock = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'config')!;
		applyCodeBlockSourceEdits({ store, events }, [{ codeBlock, code: update(codeBlock.code) }]);
	};
	return { events, store, state, memory, getMemoryBytes, disposePlugin, env, editConfig };
}

beforeEach(() => {
	fetchMock.mockReset().mockImplementation(async () => new Response(new Uint8Array([1, 2, 3, 4, 5, 6])));
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('caches', undefined);
});

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('binary assets plugin', () => {
	it('retains completed assets when only another asset URL is edited', async () => {
		const source = SOURCE.replace(
			'; @config bin.sound.memory player:buffer',
			`; @config bin.sound.memory player:buffer
; @config bin.preview.url https://example.com/preview.pcm
; @config bin.preview.memory preview:buffer`
		);
		const test = await setup({ source });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_PREVIEW_SIZE 6'));
		const previewIndicator = test.state.loadingIndicators.find(indicator => indicator.id === 'asset:preview');
		const preview = test.state.compiler.result.memoryPlan.modules.preview.memory.buffer;
		test.memory[preview.byteAddress] = 42;
		let finish!: (response: Response) => void;
		fetchMock.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));
		test.editConfig(code => code.map(line => line.replace('sample.pcm', 'new.pcm')));
		expect(test.env().code).toContain('const ASSET_PREVIEW_SIZE 6');
		expect(test.env().code).not.toContain('const ASSET_SOUND_SIZE 6');
		expect(test.state.loadingIndicators.find(indicator => indicator.id === 'asset:preview')).toBe(previewIndicator);
		expect(test.memory[preview.byteAddress]).toBe(42);
		await vi.waitFor(() =>
			expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
				'https://example.com/sample.pcm',
				'https://example.com/preview.pcm',
				'https://example.com/new.pcm',
			])
		);
		finish(new Response(new Uint8Array([7, 8])));
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 2'));
		const player = test.state.compiler.result.memoryPlan.modules.player.memory.buffer;
		expect([...test.memory.slice(player.byteAddress, player.byteAddress + 2)]).toEqual([7, 8]);
	});

	it('retains unchanged pending downloads and rejects the edited URL result', async () => {
		const completions = new Map<string, (response: Response) => void>();
		fetchMock.mockImplementation(url => new Promise(resolve => completions.set(String(url), resolve)));
		const source = SOURCE.replace(
			'; @config bin.sound.memory player:buffer',
			`; @config bin.sound.memory player:buffer
; @config bin.preview.url https://example.com/preview.pcm
; @config bin.preview.memory preview:buffer`
		);
		const test = await setup({ source });
		const oldSoundIndicator = test.state.loadingIndicators.find(indicator => indicator.id === 'asset:sound');
		const previewIndicator = test.state.loadingIndicators.find(indicator => indicator.id === 'asset:preview');
		test.editConfig(code => code.map(line => line.replace('sample.pcm', 'new.pcm')));
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
		expect(oldSoundIndicator?.status).toBe('cancelled');
		expect(test.state.loadingIndicators.find(indicator => indicator.id === 'asset:preview')).toBe(previewIndicator);
		completions.get('https://example.com/sample.pcm')!(new Response(new Uint8Array(20)));
		completions.get('https://example.com/preview.pcm')!(new Response(new Uint8Array([9])));
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_PREVIEW_SIZE 1'));
		expect(test.env().code.some(line => line.startsWith('const ASSET_SOUND_SIZE'))).toBe(false);
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'asset:sound' },
		]);
		completions.get('https://example.com/new.pcm')!(new Response(new Uint8Array([7, 8])));
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 2'));
		const preview = test.state.compiler.result.memoryPlan.modules.preview.memory.buffer;
		expect(test.memory[preview.byteAddress]).toBe(9);
	});

	it('copies retained bytes into edited memory destinations without downloading again', async () => {
		const test = await setup();
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		const indicator = test.state.loadingIndicators[0];
		test.editConfig(code => code.map(line => line.replace('player:buffer', 'preview:buffer')));
		const preview = test.state.compiler.result.memoryPlan.modules.preview.memory.buffer;
		await vi.waitFor(() =>
			expect([...test.memory.slice(preview.byteAddress, preview.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6])
		);
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(test.state.loadingIndicators).toEqual([indicator]);
		expect(test.state.loadingIndicators[0]).toBe(indicator);
	});

	it.each(['pending', 'completed'])('shares a %s download with an asset added during editing', async status => {
		const completed = status === 'completed';
		let finish!: (response: Response) => void;
		fetchMock.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));
		const test = await setup();
		if (completed) {
			finish(new Response(new Uint8Array([7, 8])));
			await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 2'));
		}
		test.editConfig(code => [
			...code.slice(0, -1),
			'; @config bin.preview.url https://example.com/sample.pcm',
			'; @config bin.preview.memory preview:buffer',
			code.at(-1)!,
		]);
		await Promise.resolve();
		expect(fetchMock).toHaveBeenCalledOnce();
		if (!completed) {
			test.editConfig(code => code.filter(line => !line.includes('@config bin.sound.')));
			expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
			finish(new Response(new Uint8Array([7, 8])));
		}
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_PREVIEW_SIZE 2'));
		if (!completed) expect(test.env().code.some(line => line.startsWith('const ASSET_SOUND_SIZE'))).toBe(false);
		const preview = test.state.compiler.result.memoryPlan.modules.preview.memory.buffer;
		expect([...test.memory.slice(preview.byteAddress, preview.byteAddress + 2)]).toEqual([7, 8]);
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it.each(['remove', 'replace'])('aborts an unused URL when config edits %s its last asset', async action => {
		fetchMock.mockImplementation(
			(_url, options) =>
				new Promise((_resolve, reject) => {
					options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
				})
		);
		const report = vi.spyOn(console, 'error').mockImplementation(() => {});
		const test = await setup();
		const signal = fetchMock.mock.calls[0][1]?.signal;
		const indicator = test.state.loadingIndicators[0];
		test.editConfig(code =>
			action === 'remove'
				? code.filter(line => !line.includes('@config bin.sound.'))
				: code.map(line => line.replace('sample.pcm', 'new.pcm'))
		);
		expect(signal?.aborted).toBe(true);
		expect(indicator.status).toBe('cancelled');
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(report).not.toHaveBeenCalled();
		expect(test.state.loadingIndicators.some(indicator => indicator.status === 'failed')).toBe(false);
		if (action === 'replace') {
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(false);
		}
	});

	it('keeps a new download when an aborted request for the same URL settles later', async () => {
		const requests: Array<{ finish: (response: Response) => void; fail: (error: Error) => void }> = [];
		fetchMock.mockImplementation(() => new Promise((finish, fail) => requests.push({ finish, fail })));
		const report = vi.spyOn(console, 'error').mockImplementation(() => {});
		const test = await setup();
		test.editConfig(code => code.map(line => line.replace('sample.pcm', 'new.pcm')));
		await vi.waitFor(() => expect(requests).toHaveLength(2));
		test.editConfig(code => code.map(line => line.replace('new.pcm', 'sample.pcm')));
		await vi.waitFor(() => expect(requests).toHaveLength(3));
		expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
		expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
		requests[0].fail(new Error('old request finished aborting'));
		await new Promise(resolve => setTimeout(resolve, 0));
		test.editConfig(code => [
			...code.slice(0, -1),
			'; @config bin.preview.url https://example.com/sample.pcm',
			'; @config bin.preview.memory preview:buffer',
			code.at(-1)!,
		]);
		requests[1].finish(new Response(new Uint8Array(20)));
		requests[2].finish(new Response(new Uint8Array([7, 8])));
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_PREVIEW_SIZE 2'));
		expect(test.env().code).toContain('const ASSET_SOUND_SIZE 2');
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(report).not.toHaveBeenCalled();
	});

	it('starts independent URLs together and copies completed assets while another fetch is pending', async () => {
		const completions = new Map<string, (response: Response) => void>();
		fetchMock.mockImplementation(url => new Promise(resolve => completions.set(String(url), resolve)));
		const source = SOURCE.replace(
			'; @config bin.sound.memory player:buffer',
			`; @config bin.sound.memory player:buffer
; @config bin.preview.url https://example.com/preview.pcm
; @config bin.preview.memory preview:buffer`
		);
		const test = await setup({ source });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'asset:sound', message: 'Loading sound...', status: 'loading' },
			{ id: 'asset:preview', message: 'Loading preview...', status: 'loading' },
		]);
		completions.get('https://example.com/preview.pcm')!(new Response(new Uint8Array([7, 8])));
		await vi.waitFor(() =>
			expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
				{ id: 'asset:sound', message: 'Loading sound...', status: 'loading' },
			])
		);
		const target = test.state.compiler.result.memoryPlan.modules.preview.memory.buffer;
		expect([...test.memory.slice(target.byteAddress, target.byteAddress + 2)]).toEqual([7, 8]);
		expect(test.env().code).toContain('const ASSET_PREVIEW_SIZE 2');
		expect(test.env().code).not.toContain('const ASSET_SOUND_SIZE 6');
		completions.get('https://example.com/sample.pcm')!(new Response(new Uint8Array(6)));
		await vi.waitFor(() =>
			expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([])
		);
		expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6');
	});

	it('ends shared-URL download indicators before either asset has runtime memory', async () => {
		const source = SOURCE.replace(
			'; @config bin.sound.memory player:buffer',
			`; @config bin.sound.memory player:buffer
; @config bin.preview.url https://example.com/sample.pcm
; @config bin.preview.memory preview:buffer`
		);
		const test = await setup({ source, withMemory: false });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_PREVIEW_SIZE 6'));
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		test.getMemoryBytes.mockReturnValue(test.memory);
		const fullPlan = test.state.compiler.result.memoryPlan;
		test.store.set('compiler.result.memoryPlan', { ...fullPlan, modules: { player: fullPlan.modules.player } });
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		const player = fullPlan.modules.player.memory.buffer;
		expect([...test.memory.slice(player.byteAddress, player.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		test.store.set('compiler.result.memoryPlan', fullPlan);
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		const preview = fullPlan.modules.preview.memory.buffer;
		expect([...test.memory.slice(preview.byteAddress, preview.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('loads configured bytes and contributes their size to the environment constants', async () => {
		const test = await setup();
		await vi.waitFor(() =>
			expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([])
		);
		const target = test.state.compiler.result.memoryPlan.modules.player.memory.buffer;
		expect([...test.memory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6');
		expect(test.env().code).toContain("; 'sample.pcm'");
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://example.com/sample.pcm', {
			signal: expect.any(AbortSignal),
		});
	});

	it('fetches a shared URL once and emits one constant for multiple memory targets', async () => {
		const source = SOURCE.replace(
			'; @config bin.sound.memory player:buffer',
			'; @config bin.sound.memory player:buffer\n; @config bin.sound.memories.preview preview:buffer'
		);
		const test = await setup({ source });
		await vi.waitFor(() =>
			expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([])
		);
		for (const name of ['player', 'preview']) {
			const target = test.state.compiler.result.memoryPlan.modules[name].memory.buffer;
			expect([...test.memory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		}
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(test.env().code.filter(line => line === 'const ASSET_SOUND_SIZE 6')).toHaveLength(1);
	});

	it('keeps a newer load with the same ID when an older fetch completes', async () => {
		const completions: Array<(response: Response) => void> = [];
		fetchMock.mockImplementation(() => new Promise(resolve => completions.push(resolve)));
		const test = await setup();
		const oldIndicator = test.state.loadingIndicators[0];
		test.events.dispatch('loadProject', { project: parseProjectSource(SOURCE.replaceAll('sample.pcm', 'new.pcm')) });
		const newIndicator = test.state.loadingIndicators[0];
		expect(newIndicator).toMatchObject({ id: 'asset:sound', message: 'Loading sound...', status: 'loading' });
		expect(newIndicator).not.toBe(oldIndicator);
		completions[0](new Response(new Uint8Array(20)));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([newIndicator]);
		test.store.loading.add({ id: 'asset:unrelated', message: 'Loading unrelated...' });
		completions[1](new Response(new Uint8Array(6)));
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		test.disposePlugin();
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'asset:unrelated', message: 'Loading unrelated...', status: 'loading' },
		]);
	});

	it('ends indicators on fetch completion and copies destinations independently afterward', async () => {
		const source = SOURCE.replace(
			'; @config bin.sound.memory player:buffer',
			`; @config bin.sound.memory player:buffer
; @config bin.sound.memories.preview preview:buffer
; @config bin.broken.url https://example.com/missing.pcm
; @config bin.broken.memory preview:buffer`
		);
		fetchMock.mockImplementation(async url => {
			if (url === 'https://example.com/missing.pcm') throw new Error('offline');
			return new Response(new Uint8Array(6).fill(7));
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const test = await setup({ source, withMemory: false });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		test.getMemoryBytes.mockReturnValue(test.memory);
		const fullPlan = test.state.compiler.result.memoryPlan;
		test.store.set('compiler.result.memoryPlan', { ...fullPlan, modules: { player: fullPlan.modules.player } });
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		test.store.set('compiler.result.memoryPlan', fullPlan);
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		const target = fullPlan.modules.preview.memory.buffer;
		expect([...test.memory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual(new Array(6).fill(7));
		expect(test.state.dialogStack).toEqual([]);
	});

	it('ends the download indicator before runtime memory is available and does not re-add it on recompilation', async () => {
		const test = await setup({ withMemory: false });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		const indicatorsChanged = vi.fn();
		test.store.subscribe('loadingIndicators', indicatorsChanged);
		test.getMemoryBytes.mockReturnValue(test.memory);
		test.store.set('compiler.result.memoryPlan', test.state.compiler.result.memoryPlan);
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		test.getMemoryBytes.mockReturnValue(undefined);
		test.store.set('compiler.result.memoryPlan', test.state.compiler.result.memoryPlan);
		expect(indicatorsChanged).not.toHaveBeenCalled();
	});

	it('loads bytes after the target memory appears and reloads without fetching after recompilation', async () => {
		const test = await setup({ compile: false });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		const compiled = await compileProject(parseProjectSource(SOURCE));
		test.store.set('compiler.result.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		test.store.set('compiler.result.compiledModules', compiled.compiledModules);
		test.store.set('compiler.result.memoryPlan', compiled.memoryPlan);
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		const nextMemory = new Uint8Array(65536);
		test.getMemoryBytes.mockReturnValue(nextMemory);
		test.store.set('compiler.result.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		test.store.set('compiler.result.compiledModules', compiled.compiledModules);
		test.store.set('compiler.result.memoryPlan', compiled.memoryPlan);
		const target = compiled.memoryPlan.modules.player.memory.buffer;
		expect([...nextMemory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('respects the allocated byte length of aligned float64 targets', async () => {
		fetchMock.mockImplementation(async () => new Response(new Uint8Array(16).fill(7)));
		const source = SOURCE.replace('player:buffer', 'player:value').replace(
			'module player\nint[] buffer 4',
			'module player\nint prefix 1\nfloat64 value 0f64\nint next 2'
		);
		const test = await setup({ source });
		await vi.waitFor(() =>
			expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([])
		);
		const target = test.state.compiler.result.memoryPlan.modules.player.memory.value;
		expect([...test.memory.slice(target.byteAddress, target.byteAddress + target.allocatedByteLength)]).toEqual(
			new Array(8).fill(7)
		);
		expect(test.memory[target.byteAddress + target.allocatedByteLength]).toBe(0);
	});

	it('resolves exposed project memory aliases', async () => {
		const source = SOURCE.replace('player:buffer', 'audio:publicBuffer').replace(
			'module player\nint[] buffer 4\nmoduleEnd',
			'group audio\nexpose publicBuffer &player:buffer\nentry main\nmodule player\nint[] buffer 4\nmoduleEnd\nentryEnd\ngroupEnd'
		);
		const test = await setup({ source });
		await vi.waitFor(() =>
			expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([])
		);
		const target = test.state.compiler.result.memoryPlan.modules['audio/player'].memory.buffer;
		expect(test.memory[target.byteAddress]).toBe(1);
	});

	it('ignores stale fetches after a project change', async () => {
		let finishOldFetch!: (response: Response) => void;
		fetchMock.mockImplementationOnce(
			() =>
				new Promise(resolve => {
					finishOldFetch = resolve;
				})
		);
		const test = await setup();
		test.events.dispatch('loadProject', { project: parseProjectSource(SOURCE.replaceAll('sample.pcm', 'new.pcm')) });
		await vi.waitFor(() => expect(test.env().code).toContain("; 'new.pcm'"));
		finishOldFetch(new Response(new Uint8Array(20)));
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6');
		expect(test.env().code).not.toContain("; 'sample.pcm'");
	});

	it('does not refetch when unrelated config changes while a fetch is pending', async () => {
		let finish!: (response: Response) => void;
		fetchMock.mockImplementationOnce(
			() =>
				new Promise(resolve => {
					finish = resolve;
				})
		);
		const test = await setup();
		test.store.set('editorConfig.testSetting', 'sample');
		finish(new Response(new Uint8Array([9])));
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 1'));
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('removes its constants and retains completed results when asset config is removed', async () => {
		const test = await setup();
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		test.events.dispatch('loadProject', { project: parseProjectSource(SOURCE.replace(/^; @config bin.*\n/gm, '')) });
		await vi.waitFor(() => expect(test.env().code).not.toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
	});

	it('logs failed fetches and marks its indicator failed', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const report = vi.spyOn(console, 'error').mockImplementation(() => {});
		const test = await setup();
		await vi.waitFor(() => expect(report).toHaveBeenCalled());
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		expect(test.state.loadingIndicators).toMatchObject([
			{ id: 'asset:sound', status: 'failed', finishedAt: expect.any(Number) },
		]);
		expect(test.env().code.some(line => line.startsWith('const ASSET_'))).toBe(false);
	});

	it('validates bin config through its contributed schema', async () => {
		const test = await setup({ source: SOURCE.replace('player:buffer', 'invalid-memory') });
		expect(test.state.codeErrors['editor-directives'].length).toBeGreaterThan(0);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('does not activate when omitted', async () => {
		const test = await setup({ installed: false });
		expect(fetchMock).not.toHaveBeenCalled();
		expect(test.state.envConstantContributions).toEqual({});
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
	});

	it('unsubscribes, removes contributions and ignores fetches completing after disposal', async () => {
		let finish!: (response: Response) => void;
		fetchMock.mockImplementationOnce(
			() =>
				new Promise(resolve => {
					finish = resolve;
				})
		);
		const test = await setup();
		expect(test.state.loadingIndicators).toHaveLength(1);
		test.disposePlugin();
		expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
		finish(new Response(new Uint8Array(10)));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(test.state.loadingIndicators).toMatchObject([{ id: 'asset:sound', status: 'cancelled' }]);
		expect(test.state.envConstantContributions).toEqual({});
		expect(test.state.editorConfigSchemaContributions).toEqual({});
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		test.store.set('compiler.result.memoryPlan', test.state.compiler.result.memoryPlan);
		expect(test.memory.every(value => value === 0)).toBe(true);
	});

	it('keeps editor installations independent', async () => {
		const first = await setup();
		let finishSecond!: (response: Response) => void;
		fetchMock.mockImplementationOnce(
			() =>
				new Promise(resolve => {
					finishSecond = resolve;
				})
		);
		const second = await setup({ withMemory: false });
		expect(first.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		expect(second.state.loadingIndicators).toHaveLength(1);
		first.disposePlugin();
		expect(second.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'asset:sound', message: 'Loading sound...', status: 'loading' },
		]);
		finishSecond(new Response(new Uint8Array(6)));
		await vi.waitFor(() => expect(second.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(second.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		expect(second.state.envConstantContributions.binaryAssets).toContain('const ASSET_SOUND_SIZE 6');
		second.getMemoryBytes.mockReturnValue(second.memory);
		second.store.set('compiler.result.memoryPlan', second.state.compiler.result.memoryPlan);
		expect(second.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
	});
});
