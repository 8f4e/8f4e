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
		store.set('compiler.compiledModules', compiled.compiledModules);
		store.set('compiler.compiledFunctions', compiled.compiledFunctions);
		store.set('compiler.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		store.set('compiler.projectMemoryExposuresByGroupPath', compiled.projectMemoryExposuresByGroupPath);
		store.set('compiler.memoryPlan', compiled.memoryPlan);
	}
	const state = store.getState();
	const env = () => state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'env')!;
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
	it('loads configured bytes and contributes their size to the environment constants', async () => {
		const test = await setup();
		await vi.waitFor(() => expect(test.state.dialogStack).toEqual([]));
		const target = test.state.compiler.memoryPlan.modules.player.memory.buffer;
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
		await vi.waitFor(() => expect(test.state.dialogStack).toEqual([]));
		for (const name of ['player', 'preview']) {
			const target = test.state.compiler.memoryPlan.modules[name].memory.buffer;
			expect([...test.memory.slice(target.byteAddress, target.byteAddress + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
		}
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(test.env().code.filter(line => line === 'const ASSET_SOUND_SIZE 6')).toHaveLength(1);
	});

	it('keeps the loading dialog until runtime memory is available', async () => {
		const test = await setup({ withMemory: false });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.dialogStack).toContainEqual(expect.objectContaining({ id: 'binary-assets-loading' }));
		test.getMemoryBytes.mockReturnValue(test.memory);
		test.store.set('compiler.memoryPlan', test.state.compiler.memoryPlan);
		expect(test.state.dialogStack).toEqual([]);
	});

	it('loads bytes after the target memory appears and reloads without fetching after recompilation', async () => {
		const test = await setup({ compile: false });
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.dialogStack).toHaveLength(1);
		const compiled = await compileProject(parseProjectSource(SOURCE), { disableSharedMemory: true });
		test.store.set('compiler.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		test.store.set('compiler.compiledModules', compiled.compiledModules);
		test.store.set('compiler.memoryPlan', compiled.memoryPlan);
		expect(test.state.dialogStack).toEqual([]);
		const nextMemory = new Uint8Array(65536);
		test.getMemoryBytes.mockReturnValue(nextMemory);
		test.store.set('compiler.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
		test.store.set('compiler.compiledModules', compiled.compiledModules);
		test.store.set('compiler.memoryPlan', compiled.memoryPlan);
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
		await vi.waitFor(() => expect(test.state.dialogStack).toEqual([]));
		const target = test.state.compiler.memoryPlan.modules.player.memory.value;
		expect([...test.memory.slice(target.byteAddress, target.byteAddress + target.allocatedByteLength)]).toEqual(
			new Array(8).fill(7)
		);
		expect(test.memory[target.byteAddress + target.allocatedByteLength]).toBe(0);
	});

	it('resolves exposed project memory aliases', async () => {
		const source = SOURCE.replace('player:buffer', 'audio:publicBuffer').replace(
			'module player\nint[] buffer 4\nmoduleEnd',
			'group audio\nexpose publicBuffer &player:buffer\nmodule player\nint[] buffer 4\nmoduleEnd\ngroupEnd'
		);
		const test = await setup({ source });
		await vi.waitFor(() => expect(test.state.dialogStack).toEqual([]));
		const target = test.state.compiler.memoryPlan.modules['audio/player'].memory.buffer;
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
		test.store.set('editorConfig.font', 'ibmvga8x16');
		finish(new Response(new Uint8Array([9])));
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 1'));
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('removes its constants and dialog when asset config is removed', async () => {
		const test = await setup();
		await vi.waitFor(() => expect(test.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		test.events.dispatch('loadProject', { project: parseProjectSource(SOURCE.replace(/^; @config bin.*\n/gm, '')) });
		await vi.waitFor(() => expect(test.env().code).not.toContain('const ASSET_SOUND_SIZE 6'));
		expect(test.state.dialogStack).toEqual([]);
	});

	it('logs failed fetches and closes its loading dialog', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const report = vi.spyOn(console, 'error').mockImplementation(() => {});
		const test = await setup();
		await vi.waitFor(() => expect(report).toHaveBeenCalled());
		expect(test.state.dialogStack).toEqual([]);
		expect(test.env().code.some(line => line.startsWith('const ASSET_'))).toBe(false);
	});

	it('validates bin config through its contributed schema', async () => {
		const test = await setup({ source: SOURCE.replace('player:buffer', 'invalid-memory') });
		expect(test.state.codeErrors.editorDirectiveErrors.length).toBeGreaterThan(0);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('does not activate when omitted', async () => {
		const test = await setup({ installed: false });
		expect(fetchMock).not.toHaveBeenCalled();
		expect(test.state.envConstantContributions).toEqual({});
		expect(test.state.dialogStack).toEqual([]);
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
		expect(test.state.dialogStack).toHaveLength(1);
		test.disposePlugin();
		finish(new Response(new Uint8Array(10)));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(test.state.envConstantContributions).toEqual({});
		expect(test.state.editorConfigSchemaContributions).toEqual({});
		expect(test.state.dialogStack).toEqual([]);
		test.store.set('compiler.memoryPlan', test.state.compiler.memoryPlan);
		expect(test.memory.every(value => value === 0)).toBe(true);
	});

	it('keeps editor installations independent', async () => {
		const first = await setup();
		const second = await setup({ withMemory: false });
		await vi.waitFor(() => expect(second.env().code).toContain('const ASSET_SOUND_SIZE 6'));
		expect(first.state.dialogStack).toEqual([]);
		expect(second.state.dialogStack).toHaveLength(1);
		first.disposePlugin();
		expect(second.state.envConstantContributions.binaryAssets).toContain('const ASSET_SOUND_SIZE 6');
		second.getMemoryBytes.mockReturnValue(second.memory);
		second.store.set('compiler.memoryPlan', second.state.compiler.memoryPlan);
		expect(second.state.dialogStack).toEqual([]);
	});
});
