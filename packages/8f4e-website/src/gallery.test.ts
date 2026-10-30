import { type MinimalEditorInstance, mountMinimalEditor } from '@8f4e/editor-minimal';
import type { WebMcpTool } from '@8f4e/editor-webmcp';
import { afterEach, expect, test, vi } from 'vitest';
import { mountGallery } from './gallery';

vi.mock('@8f4e/editor-minimal', { spy: true });

const source = '8f4e/v1\nentry main\nmodule galleryExample ; @mode edit\nint value 1\nmoduleEnd\nentryEnd';
const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

function setup(responses: Record<string, () => Promise<Response>>) {
	const fetch = globalThis.fetch.bind(globalThis);
	vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
		const id = Object.keys(responses).find(id => input === `/gallery-${id}.8f4e`);
		return id ? responses[id]() : fetch(input, options);
	});
	const ids = Object.keys(responses);
	const originalUrl = window.location.href;
	window.history.replaceState(null, '', `#${ids[0]}`);
	const gallery = document.createElement('div');
	gallery.id = 'examples-gallery';
	document.body.append(gallery);
	const dispose = mountGallery({
		title: 'Examples',
		categories: [
			{
				path: 'test',
				title: 'Test',
				projects: ids.map(id => ({
					id,
					title: id,
					description: 'A gallery fixture.',
					projectUrl: `/gallery-${id}.8f4e`,
					previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
					githubUrl: 'https://github.com/8f4e/8f4e',
				})),
			},
		],
	});
	cleanups.push(() => {
		dispose();
		gallery.remove();
		window.history.replaceState(null, '', originalUrl);
	});
	const panel = (id = ids[0]) => gallery.querySelector<HTMLElement>(`#panel-${id}`)!;
	const mounted = async (index = 0): Promise<MinimalEditorInstance> => {
		await vi.waitFor(() => expect(mountMinimalEditor).toHaveBeenCalledTimes(index + 1));
		return await vi.mocked(mountMinimalEditor).mock.results[index].value;
	};
	return { gallery, panel, mounted };
}

test('keeps the editor mounted while a project fetch is pending and reveals it on completion', async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup({ delayed: () => pending });
	const editor = await view.mounted();
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	const canvas = view.panel().querySelector('canvas')!;
	expect(status.textContent).toBe('Loading project…');
	expect(canvas.isConnected).toBe(true);
	expect(canvas.classList.contains('editor-ready')).toBe(false);
	finish(new Response(source));
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	expect(status.hidden).toBe(true);
	expect(editor.state.initialProjectState?.modules[0].code).toContain('module galleryExample ; @mode edit');
});

test('reveals a successfully loaded empty project', async () => {
	const view = setup({ empty: async () => new Response('8f4e/v1') });
	await view.mounted();
	const canvas = view.panel().querySelector('canvas')!;
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	expect(view.panel().querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(true);
});

test('keeps live editing available with the minimal project menu', async () => {
	const view = setup({
		minimal: async () => new Response(source.replace('int value 1', '; @pos 4 10\n; @favorite\nint value 1')),
	});
	const editor = await view.mounted();
	const canvas = view.panel().querySelector('canvas')!;
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	canvas.style.width = '640px';
	canvas.style.height = '400px';
	await vi.waitFor(() => expect(editor.state.viewport.width).toBe(640));
	await vi.waitFor(() => expect(editor.state.compiler.compiledModules.galleryExample).toBeDefined());
	expect(editor.state.editorMode).toBe('edit');
	expect(editor.state.featureFlags.projectCreation).toBe(false);
	const rect = canvas.getBoundingClientRect();
	canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: rect.x + 600, clientY: rect.y + 100, bubbles: true }));
	await vi.waitFor(() =>
		expect(editor.state.contextMenu.items.some(item => item.action === 'createCodeBlock')).toBe(true)
	);
	const menu = editor.state.contextMenu.items;
	for (const action of [
		'importProject',
		'exportProject',
		'exportWasm',
		'exportCanvasScreenshot',
		'loadPluginsUsedByProject',
	]) {
		expect(menu.some(item => item.action === action)).toBe(false);
	}
	expect(menu.some(item => item.title === 'Add Built-in Block')).toBe(false);
	expect(menu.some(item => item.payload?.menu === 'favoritesMenu')).toBe(false);
	editor.pauseRendering();
	editor.renderFrame();
	await expect(canvas).toMatchScreenshot('minimal-project-menu');
});

test('loads and runs worker and test runtime plugins together through the minimal composition', async () => {
	const view = setup({
		runtimes: async () =>
			new Response(`8f4e/v1
note settings
; @config recompileDebounceDelay 10
; @config workerRuntime.enabled true
; @config workerRuntime.sampleRateConstantName CONTROL_RATE
; @config testRuntime.enabled true
noteEnd
entry main
module counter
int count 0
push &count
push count
push 1
add
store
moduleEnd
entryEnd
entry test
module checks
push 1
assert
moduleEnd
entryEnd`),
	});
	const editor = await view.mounted();
	await vi.waitFor(
		() => expect(editor.state.info.testRuntime).toEqual({ status: 'passed', assertionCount: 1, failureCount: 0 }),
		{ timeout: 10000 }
	);
	const memory = editor.state.compiler.memoryPlan.modules.counter.memory.count;
	await vi.waitFor(() => expect(editor.getMemoryViews().int32[memory.allocationUnitAddress]).toBeGreaterThan(2));
	expect(editor.state.codeErrors.compilationErrors).toEqual([]);
	expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
	expect(editor.state.envConstantContributions.workerRuntime).toEqual(['const CONTROL_RATE 50']);
});

test('compiles a loaded project through the compiler plugin and refreshes editor memory views', async () => {
	const configuredSource = source.replace('int value 1', '; @config recompileDebounceDelay 10\nint value 1');
	const view = setup({ compiled: async () => new Response(configuredSource) });
	const editor = await view.mounted();
	await vi.waitFor(
		() =>
			expect(Object.keys(editor.state.compiler.compiledModules).some(id => id.includes('galleryExample'))).toBe(true),
		{ timeout: 10000 }
	);
	expect(editor.state.codeErrors.compilationErrors).toEqual([]);
	expect(editor.state.codeErrors.editorDirectiveErrors).toEqual([]);
	expect(editor.state.editorConfig.recompileDebounceDelay).toBe(10);
	expect(editor.state.compiler.isCompiling).toBe(false);
	expect(editor.state.info.compiler?.wasmByteCodeBytes).toBeGreaterThan(0);
	expect(editor.getMemoryViews().int32.byteLength).toBeGreaterThan(0);
});

test('loads directive plugins from a gallery project and connects their controls to compiler memory', async () => {
	const view = setup({
		controls: async () =>
			new Response(`8f4e/v1
note
; @config recompileDebounceDelay 10
noteEnd
entry main
module controls
; @pos 4 3
int value 0
float left 0
float right 0
int[] points 4
int[] notes 8
int pressed 0
; @switch &value
; @button &value
; @wave &points 4
; @meter &value
; @bars &points 4
; @piano &notes &pressed 48
; @slider &value 0 100 1
; @crossfade &left &right
moduleEnd
entryEnd`),
	});
	const editor = await view.mounted();
	await vi.waitFor(() => expect(editor.state.compiler.memoryPlan.modules.controls).toBeDefined(), { timeout: 10000 });
	const state = editor.state;
	const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'controls')!;
	await vi.waitFor(
		() => expect([10, 11, 12, 13, 14, 15].map(row => block.gaps.get(row)?.size)).toEqual([2, 1, 8, 6, 2, 2]),
		{ timeout: 10000 }
	);
	expect(state.codeErrors.compilationErrors).toEqual([]);
	const canvas = view.panel().querySelector('canvas')!;
	const address = state.compiler.memoryPlan.modules.controls.memory.value.allocationUnitAddress;
	const press = (row: number) => {
		const rect = canvas.getBoundingClientRect();
		canvas.dispatchEvent(
			new MouseEvent('mousedown', {
				clientX: rect.x + block.x + block.width - state.viewport.x - state.viewport.vGrid,
				clientY: rect.y + block.y + row * state.viewport.hGrid - state.viewport.y + 1,
				buttons: 1,
				bubbles: true,
			})
		);
	};
	press(8);
	expect(editor.getMemoryViews().int32[address]).toBe(1);
	canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	press(8);
	expect(editor.getMemoryViews().int32[address]).toBe(0);
	canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	press(9);
	expect(editor.getMemoryViews().int32[address]).toBe(1);
	canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	expect(editor.getMemoryViews().int32[address]).toBe(0);
});

test('reports a failed request immediately and loads the project when retried', async () => {
	let requests = 0;
	const view = setup({
		retry: async () => {
			if (++requests === 1) throw new Error('Offline');
			return new Response(source);
		},
	});
	await view.mounted();
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	await vi.waitFor(() => expect(status.textContent).toContain('This project could not be loaded.'));
	expect(view.panel().querySelector('canvas')).toBeNull();
	status.querySelector<HTMLButtonElement>('button')!.click();
	await view.mounted(1);
	await vi.waitFor(() => expect(view.panel().querySelector('canvas')?.classList.contains('editor-ready')).toBe(true));
	expect(status.hidden).toBe(true);
});

test('disposes an editor when loading fails before its mount promise resolves', async () => {
	const dispose = vi.fn();
	vi.mocked(mountMinimalEditor).mockImplementationOnce(async (_canvas, options) => {
		options?.onInitialProjectLoadError?.(new Error('Offline'));
		return { dispose } as unknown as MinimalEditorInstance;
	});
	const view = setup({ early: async () => new Response(source) });
	await view.mounted();
	await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
	expect(view.panel().querySelector('canvas')).toBeNull();
	expect(view.panel().querySelector('[role="status"]')?.textContent).toContain('This project could not be loaded.');
});

test('switches examples without waiting for the previous fetch and ignores its late completion', async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup({ first: () => pending, second: async () => new Response(source) });
	await view.mounted();
	const firstCanvas = view.panel('first').querySelector('canvas')!;
	view.gallery.querySelector<HTMLButtonElement>('#example-second')!.click();
	await view.mounted(1);
	await vi.waitFor(() =>
		expect(view.panel('second').querySelector('canvas')?.classList.contains('editor-ready')).toBe(true)
	);
	expect(firstCanvas.isConnected).toBe(false);
	finish(new Response(source));
	await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
	expect(view.panel('second').querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(true);
	expect(view.panel('second').querySelector('canvas')?.classList.contains('editor-ready')).toBe(true);
	expect(view.panel('first').querySelector('canvas')).toBeNull();
});

function siteTools() {
	const original = Object.getOwnPropertyDescriptor(document, 'modelContext');
	const tools = new Map<string, WebMcpTool>();
	Object.defineProperty(document, 'modelContext', {
		configurable: true,
		value: {
			registerTool(tool: WebMcpTool, { signal }: { signal: AbortSignal }) {
				tools.set(tool.name, tool);
				signal.addEventListener('abort', () => {
					if (tools.get(tool.name) === tool) tools.delete(tool.name);
				});
			},
		},
	});
	cleanups.push(() => {
		if (original) Object.defineProperty(document, 'modelContext', original);
		else Reflect.deleteProperty(document, 'modelContext');
	});
	return tools;
}

test('registers site tools only after the selected project has loaded', async () => {
	const tools = siteTools();
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup({ bridged: () => pending });
	await view.mounted();
	expect(tools.size).toBe(0);
	finish(new Response(source));
	await vi.waitFor(() => expect(tools.has('get_compiler_diagnostics')).toBe(true));
	expect(await tools.get('get_project')!.execute({})).toContain('module galleryExample');
});

test('replaces site tools and requires a fresh source read for the replacement editor', async () => {
	const tools = siteTools();
	const view = setup({
		first: async () => new Response(source),
		second: async () => new Response(source.replace('galleryExample', 'secondExample')),
	});
	await view.mounted();
	await vi.waitFor(() => expect(tools.has('get_compiler_diagnostics')).toBe(true));
	await tools.get('get_project')!.execute({});
	const retained = tools.get('apply_edits')!;
	view.gallery.querySelector<HTMLButtonElement>('#example-second')!.click();
	expect(tools.size).toBe(0);
	const editor = await view.mounted(1);
	await vi.waitFor(() => expect(tools.has('get_compiler_diagnostics')).toBe(true));
	const args = { edits: [{ operation: 'delete', type: 'module', name: 'secondExample' }] };
	expect(await retained.execute(args)).toMatchObject({ error: { code: 'disposed' } });
	await tools.get('get_project_metadata')!.execute({});
	expect(await tools.get('apply_edits')!.execute(args)).toMatchObject({ error: { code: 'source_required' } });
	expect(editor.state.codeBlockRendering.codeBlocks.find(block => block.blockType === 'module')!.code[0]).toBe(
		'module secondExample ; @mode edit'
	);
	expect(await tools.get('get_project')!.execute({})).toContain('module secondExample');
	expect(await tools.get('apply_edits')!.execute(args)).toBe('Edits applied.');
	expect(editor.state.codeBlockRendering.codeBlocks.filter(block => block.blockType === 'module')).toHaveLength(0);
	expect(tools.size).toBe(18);
});
