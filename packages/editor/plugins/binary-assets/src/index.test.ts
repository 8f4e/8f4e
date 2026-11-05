import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
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
		const compiled = await compileProject(project, { disableSharedMemory: true });
		store.set('compiler.result.compiledModules', compiled.compiledModules);
		store.set('compiler.result.compiledFunctions', compiled.compiledFunctions);
		store.set('compiler.result.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		store.set('compiler.result.projectMemoryExposuresByGroupPath', compiled.projectMemoryExposuresByGroupPath);
		store.set('compiler.result.memoryPlan', compiled.memoryPlan);
	}
	const state = store.getState();
	const env = () => state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'env')!;
	return { events, store, state, memory, getMemoryBytes, disposePlugin, env };
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
		expect(test.state.loadingIndicators).toEqual([{ name: 'sound' }, { name: 'preview' }]);
		completions.get('https://example.com/preview.pcm')!(new Response(new Uint8Array([7, 8])));
		await vi.waitFor(() => expect(test.state.loadingIndicators).toEqual([{ name: 'sound' }]));
		const target = test.state.compiler.result.memoryPlan.modules.preview.memory.buffer;
		expect([...test.memory.slice(target.byteAddress, target.byteAddress + 2)]).toEqual([7, 8]);
		expect(test.env().code).toContain('const ASSET_PREVIEW_SIZE 2');
		expect(test.env().code).not.toContain('const ASSET_SOUND_SIZE 6');
		completions.get('https://example.com/sample.pcm')!(new Response(new Uint8Array(6)));
		await vi.waitFor(() => expect(test.state.loadingIndicators).toEqual([]));
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
		expect(test.state.loadingIndicators).toEqual([]);
		test.getMemoryBytes.mockReturnValue(test.memory);
		const fullPlan = test.state.compiler.result.memoryPlan;
		test.store.set('compiler.result.memoryPlan', { ...fullPlan, modules: { player: fullPlan.modules.player } });
		expect(test.state.loadingIndicators).toEqual([]);
		const player = fullPlan.modules.player.memory.buffer;
		expect([...test.memory.slice(player.byteAddress, player.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		test.store.set('compiler.result.memoryPlan', fullPlan);
		expect(test.state.loadingIndicators).toEqual([]);
		const preview = fullPlan.modules.preview.memory.buffer;
		expect([...test.memory.slice(preview.byteAddress, preview.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('loads configured bytes and contributes their size to the environment constants', async () => {
		const test = await setup();
		await vi.waitFor(() => expect(test.state.loadingIndicators).toEqual([]));
		const target = test.state.compiler.result.memoryPlan.modules.player.memory.buffer;
		expect([...test.memory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6');
		expect(test.env().code).toContain("; 'sample.pcm'");
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://example.com/sample.pcm');
	});

	it('fetches a shared URL once and emits one constant for multiple memory targets', async () => {
		const source = SOURCE.replace(
			'; @config bin.sound.memory player:buffer',
			'; @config bin.sound.memory player:buffer\n; @config bin.sound.memories.preview preview:buffer'
		);
		const test = await setup({ source });
		await vi.waitFor(() => expect(test.state.loadingIndicators).toEqual([]));
		for (const name of ['player', 'preview']) {
			const target = test.state.compiler.result.memoryPlan.modules[name].memory.buffer;
			expect([...test.memory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		}
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(test.env().code.filter(line => line === 'const ASSET_SOUND_SIZE 6')).toHaveLength(1);
	});

	it('keeps a newer load with the same name when an older fetch completes', async () => {
		const completions: Array<(response: Response) => void> = [];
		fetchMock.mockImplementation(() => new Promise(resolve => completions.push(resolve)));
		const test = await setup();
		const oldIndicator = test.state.loadingIndicators[0];
		test.events.dispatch('loadProject', { project: parseProjectSource(SOURCE.replaceAll('sample.pcm', 'new.pcm')) });
		const newIndicator = test.state.loadingIndicators[0];
		expect(newIndicator).toEqual({ name: 'sound' });
		expect(newIndicator).not.toBe(oldIndicator);
		completions[0](new Response(new Uint8Array(20)));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(test.state.loadingIndicators).toEqual([newIndicator]);
		test.store.set('loadingIndicators', [...test.state.loadingIndicators, { name: 'unrelated' }]);
		completions[1](new Response(new Uint8Array(6)));
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		test.disposePlugin();
		expect(test.state.loadingIndicators).toEqual([{ name: 'unrelated' }]);
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
		expect(test.state.loadingIndicators).toEqual([]);
		test.getMemoryBytes.mockReturnValue(test.memory);
		const fullPlan = test.state.compiler.result.memoryPlan;
		test.store.set('compiler.result.memoryPlan', { ...fullPlan, modules: { player: fullPlan.modules.player } });
		expect(test.state.loadingIndicators).toEqual([]);
		test.store.set('compiler.result.memoryPlan', fullPlan);
		expect(test.state.loadingIndicators).toEqual([]);
		const target = fullPlan.modules.preview.memory.buffer;
		expect([...test.memory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual(new Array(6).fill(7));
		expect(test.state.dialogStack).toEqual([]);
	});

	it('ends the download indicator before runtime memory is available and does not re-add it on recompilation', async () => {
		const test = await setup({ withMemory: false });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.loadingIndicators).toEqual([]);
		const indicatorsChanged = vi.fn();
		test.store.subscribe('loadingIndicators', indicatorsChanged);
		test.getMemoryBytes.mockReturnValue(test.memory);
		test.store.set('compiler.result.memoryPlan', test.state.compiler.result.memoryPlan);
		expect(test.state.loadingIndicators).toEqual([]);
		test.getMemoryBytes.mockReturnValue(undefined);
		test.store.set('compiler.result.memoryPlan', test.state.compiler.result.memoryPlan);
		expect(indicatorsChanged).not.toHaveBeenCalled();
	});

	it('loads bytes after the target memory appears and reloads without fetching after recompilation', async () => {
		const test = await setup({ compile: false });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.loadingIndicators).toEqual([]);
		const compiled = await compileProject(parseProjectSource(SOURCE), { disableSharedMemory: true });
		test.store.set('compiler.result.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		test.store.set('compiler.result.compiledModules', compiled.compiledModules);
		test.store.set('compiler.result.memoryPlan', compiled.memoryPlan);
		expect(test.state.loadingIndicators).toEqual([]);
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
		await vi.waitFor(() => expect(test.state.loadingIndicators).toEqual([]));
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
		await vi.waitFor(() => expect(test.state.loadingIndicators).toEqual([]));
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

	it('removes its constants and indicators when asset config is removed', async () => {
		const test = await setup();
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		test.events.dispatch('loadProject', { project: parseProjectSource(SOURCE.replace(/^; @config bin.*\n/gm, '')) });
		await vi.waitFor(() => expect(test.env().code).not.toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.loadingIndicators).toEqual([]);
	});

	it('logs failed fetches and closes its loading indicator', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const report = vi.spyOn(console, 'error').mockImplementation(() => {});
		const test = await setup();
		await vi.waitFor(() => expect(report).toHaveBeenCalled());
		expect(test.state.loadingIndicators).toEqual([]);
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
		expect(test.state.loadingIndicators).toEqual([]);
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
		finish(new Response(new Uint8Array(10)));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(test.state.envConstantContributions).toEqual({});
		expect(test.state.editorConfigSchemaContributions).toEqual({});
		expect(test.state.loadingIndicators).toEqual([]);
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
		expect(first.state.loadingIndicators).toEqual([]);
		expect(second.state.loadingIndicators).toHaveLength(1);
		first.disposePlugin();
		expect(second.state.loadingIndicators).toEqual([{ name: 'sound' }]);
		finishSecond(new Response(new Uint8Array(6)));
		await vi.waitFor(() => expect(second.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(second.state.loadingIndicators).toEqual([]);
		expect(second.state.envConstantContributions.binaryAssets).toContain('const ASSET_SOUND_SIZE 6');
		second.getMemoryBytes.mockReturnValue(second.memory);
		second.store.set('compiler.result.memoryPlan', second.state.compiler.result.memoryPlan);
		expect(second.state.loadingIndicators).toEqual([]);
	});
});
