import { getEditorBlockId } from '@8f4e/editor-core';
import { type GalleryEditorInstance, mountGalleryEditor } from '@8f4e/editor-gallery';
import type { WebMcpTool } from '@8f4e/editor-webmcp';
import type {} from '@vitest/browser-playwright';
import { afterEach, expect, test, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import { getExampleProjectPreviewUrl } from './example-projects';
import { mountGallery } from './gallery';

vi.mock('@8f4e/editor-gallery', { spy: true });

const source = '8f4e/v1\nentry main\nmodule galleryExample ; @mode edit\nint value 1\nmoduleEnd\nentryEnd';
const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function setup(
	responses: Record<string, () => Promise<Response>>,
	{ previewUrl }: { previewUrl?: string } = {
		previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
	}
) {
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
					previewUrl,
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
	const started = async (index = 0) => {
		await vi.waitFor(() => expect(mountGalleryEditor).toHaveBeenCalledTimes(index + 1));
	};
	const mounted = async (index = 0): Promise<GalleryEditorInstance> => {
		await started(index);
		return await vi.mocked(mountGalleryEditor).mock.results[index].value;
	};
	return { gallery, panel, started, mounted, dispose };
}

test('keeps sidebar selection in place but scrolls when following a fragment link', async () => {
	const view = setup({ first: async () => new Response(source), second: async () => new Response(source) });
	cleanups.push(() => window.scrollTo(0, 0));
	// Match the desktop layout: switching editors doesn't change the list height.
	view.panel('first').style.position = 'fixed';
	view.panel('second').style.position = 'fixed';
	view.gallery.style.paddingBottom = '100vh';
	const button = view.gallery.querySelector<HTMLButtonElement>('button#example-second')!;
	const target = document.getElementById('second')!;
	target.style.marginTop = '200vh';
	window.scrollTo(0, window.scrollY + target.getBoundingClientRect().top - window.innerHeight / 2);
	const sidebarScroll = window.scrollY;
	expect(sidebarScroll).toBeGreaterThan(0);

	button.focus({ preventScroll: true });
	await userEvent.keyboard(' ');
	expect(window.location.hash).toBe('#second');
	expect(button.getAttribute('aria-expanded')).toBe('true');
	expect(view.panel('first').hidden).toBe(true);
	await new Promise(requestAnimationFrame);
	expect(window.scrollY).toBe(sidebarScroll);

	const first = document.getElementById('first')!;
	expect(first.getBoundingClientRect().bottom).toBeLessThan(0);
	window.location.hash = '#first';
	await expect.poll(() => view.panel('first').hidden).toBe(false);
	expect(first.getBoundingClientRect().bottom).toBeGreaterThan(0);
});

test('keeps the loading canvas while mounting waits for the project and reveals it on completion', async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup({ delayed: () => pending });
	await view.started();
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	const canvas = view.panel().querySelector('canvas')!;
	expect(status.textContent).toBe('Loading project…');
	expect(canvas.isConnected).toBe(true);
	expect(canvas.classList.contains('editor-ready')).toBe(false);
	finish(new Response(source));
	const editor = await view.mounted();
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	expect(status.hidden).toBe(true);
	expect(editor.state.project.rootLevel.blocks.find(block => block.name === 'galleryExample')?.code).toContain(
		'module galleryExample ; @mode edit'
	);
});

test('keeps the loading status visible until the editor has mounted', async () => {
	let finish!: (editor: GalleryEditorInstance) => void;
	const pending = new Promise<GalleryEditorInstance>(resolve => {
		finish = resolve;
	});
	vi.mocked(mountGalleryEditor).mockImplementationOnce(() => pending);
	const view = setup({ delayedMount: async () => new Response(source) });
	await view.started();
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	const canvas = view.panel().querySelector('canvas')!;
	await new Promise(requestAnimationFrame);
	expect(canvas.classList.contains('editor-ready')).toBe(false);
	expect(status.hidden).toBe(false);
	expect(status.textContent).toBe('Loading project…');

	finish({ editing: {}, navigation: {}, dispose: vi.fn() } as unknown as GalleryEditorInstance);
	await view.mounted();
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	expect(status.hidden).toBe(true);
});

test('reveals a successfully loaded empty project', async () => {
	const view = setup({ empty: async () => new Response('8f4e/v1') });
	await view.mounted();
	const canvas = view.panel().querySelector('canvas')!;
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	expect(view.panel().querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(true);
});

test.each([
	{ slack: undefined, screenshot: 'gallery-loose-wires' },
	{ slack: 0, screenshot: 'gallery-zero-slack' },
])('draws a wire between gallery connectors with $screenshot', async ({ slack, screenshot }) => {
	const config =
		slack === undefined ? '' : `\nnote wireConfig\n; @pos 180 60\n; @config looseWires.slack ${slack}\nnoteEnd`;
	const view = setup({
		wires: async () =>
			new Response(`8f4e/v1${config}
entry main
module osc
; @pos 4 9
float out 0.5
moduleEnd
module amp
; @pos 48 9
float* in &osc:out
moduleEnd
entryEnd`),
	});
	const editor = await view.mounted();
	await vi.dynamicImportSettled();
	await expect.poll(() => editor.state.editorConfigSchemaContributions.looseWires).toBeDefined();
	await vi.waitFor(() => expect(editor.getCompilerDiagnostics()?.status).toBe('ready'));
	expect(editor.state.editorConfig.looseWires).toEqual(slack === undefined ? undefined : { slack });
	editor.pauseRendering();
	const canvas = view.panel().querySelector('canvas')!;
	canvas.style.width = '704px';
	canvas.style.height = '272px';
	await expect.poll(() => editor.state.viewport.width).toBe(704);
	// Refresh the overlay layout without transient loading times in the capture.
	editor.state.loadingIndicators = [];
	const rendering = editor.state.project;
	rendering.selectedCodeBlock = rendering.activeLevel.blocks.find(block => block.name === 'amp');
	editor.resize(704, 272);
	editor.renderFrame();
	await expect(canvas).toMatchScreenshot(screenshot);
	if (slack === 0) {
		const uniform1f = vi.spyOn(canvas.getContext('webgl2')!, 'uniform1f');
		editor.renderFrame();
		const [slackUniform, initialSlack] = uniform1f.mock.calls.at(-1)!;
		expect(initialSlack).toBe(0);
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', cancelable: true }));
		expect(editor.state.editorMode).toBe('edit');
		const configNote = rendering.activeLevel.blocks.find(block => block.name === 'wireConfig')!;
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [{ type: 'delete', blockId: getEditorBlockId(configNote) }],
		});
		expect(editor.state.editorConfig.looseWires).toBeUndefined();
		await vi.waitFor(() => expect(editor.getCompilerDiagnostics()?.status).toBe('ready'));
		editor.renderFrame();
		expect(uniform1f).toHaveBeenLastCalledWith(slackUniform, 0.25);
	}
});

test('keeps the wheel-panned viewport at its last pixel position after scrolling stops', async () => {
	const view = setup({ empty: async () => new Response('8f4e/v1') });
	const editor = await view.mounted();
	await vi.dynamicImportSettled();
	const canvas = view.panel().querySelector('canvas')!;
	const { x, y } = editor.state.viewport;
	const panned = { x: x - 3, y: y + 5 };
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	try {
		const wheel = new WheelEvent('wheel', { deltaX: -3, deltaY: 5, cancelable: true });
		canvas.dispatchEvent(wheel);
		expect(wheel.defaultPrevented).toBe(true);
		expect(editor.state.viewport).toMatchObject(panned);
		vi.advanceTimersByTime(200);
		expect(editor.state.viewport).toMatchObject(panned);
	} finally {
		vi.useRealTimers();
	}
});

test('cycles fonts with F8/F9 and shows credits without changing example source', async () => {
	const view = setup({ fonts: async () => new Response(source) });
	const editor = await view.mounted();
	await vi.dynamicImportSettled();
	await vi.waitFor(() => expect(editor.getCompilerDiagnostics()?.status).toBe('ready'));
	editor.pauseRendering();
	const canvas = view.panel().querySelector('canvas')!;
	canvas.style.width = '640px';
	canvas.style.height = '400px';
	await expect.poll(() => editor.state.viewport.width).toBe(640);
	const sources = editor.state.project.rootLevel.blocks.map(block => [...block.code]);
	const revision = editor.editing.getRevision();
	const sourceFont = editor.state.editorConfig.font;
	const key = (key: string) => {
		const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
		canvas.dispatchEvent(event);
		return event;
	};
	expect(key('F8').defaultPrevented).toBe(true);
	await expect.poll(() => editor.state.viewport.hGrid).toBe(12);
	expect(editor.state.appearance.fontOverride).toBe('spleen6x12');
	expect(editor.state.editorConfig.font).toBe(sourceFont);
	expect(key('F9').defaultPrevented).toBe(true);
	await expect.poll(() => editor.state.viewport.hGrid).toBe(16);
	expect(editor.state.appearance.fontOverride).toBe('ibmvga8x16');
	expect(editor.state.editorConfig.font).toBe(sourceFont);
	// Remove transient loading rows and refresh overlay layout for a stable canvas snapshot.
	editor.state.loadingIndicators = [];
	editor.resize(640, 400);
	await expect(canvas).toMatchScreenshot('gallery-font-credits');
	expect(editor.state.project.rootLevel.blocks.map(block => block.code)).toEqual(sources);
	expect(editor.editing.getRevision()).toBe(revision);
	editor.dispose();
	expect(editor.state.appearance.fontOverride).toBeUndefined();
	expect(key('F9').defaultPrevented).toBe(false);
});

test('uses Departure Mono for touch devices unless the project sets its own font', async () => {
	const input = cdp();
	await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
	try {
		const view = setup({
			default: async () => new Response(source),
			override: async () => new Response(source.replace('; @mode edit', '; @mode edit\n; @config font ibmvga8x16')),
		});
		const editor = await view.mounted();
		expect(editor.state.editorConfig.font).toBeUndefined();
		expect(editor.state.viewport).toMatchObject({ vGrid: 7, hGrid: 14 });

		view.gallery.querySelector<HTMLButtonElement>('#example-override')!.click();
		const overriddenEditor = await view.mounted(1);
		expect(overriddenEditor.state.editorConfig.font).toBe('ibmvga8x16');
		expect(overriddenEditor.state.viewport).toMatchObject({ vGrid: 8, hGrid: 16 });
	} finally {
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});

test('one-finger gallery drags pan horizontally while vertical swipes scroll the page', async () => {
	const input = cdp();
	await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
	const originalMinHeight = document.body.style.minHeight;
	document.body.style.minHeight = '2000px';
	window.scrollTo(0, 0);
	try {
		const view = setup({ touch: async () => new Response(source) });
		const editor = await view.mounted();
		editor.pauseRendering();
		const canvas = view.panel().querySelector('canvas')!;
		canvas.style.width = '640px';
		canvas.style.height = '400px';
		await expect.poll(() => editor.state.viewport.width).toBe(640);
		await expect.poll(() => canvas.style.touchAction).toBe('pan-y');
		const rect = canvas.getBoundingClientRect();
		const frame = window.frameElement!.getBoundingClientRect();
		const point = (x: number, y: number) => ({ x: frame.left + rect.left + x, y: frame.top + rect.top + y, id: 1 });
		const { x, y } = editor.state.viewport;
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(300, 200)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(320, 202)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(337, 204)] });
		await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		expect(editor.state.viewport).toMatchObject({ x: x - 37, y });
		expect(window.scrollY).toBe(0);
		const scrollStart = point(400, 300);
		await input.send('Input.synthesizeScrollGesture', {
			x: scrollStart.x,
			y: scrollStart.y,
			yDistance: -130,
			gestureSourceType: 'touch',
			preventFling: true,
		});
		await expect.poll(() => window.scrollY).toBeGreaterThan(0);
		expect(editor.state.viewport).toMatchObject({ x: x - 37, y });
	} finally {
		document.body.style.minHeight = originalMinHeight;
		window.scrollTo(0, 0);
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});

test('keeps live editing and project export available in the gallery editor', async () => {
	const writable = {
		write: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
	};
	const requestPermission = vi.fn().mockResolvedValue('granted');
	const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable: async () => writable, requestPermission });
	vi.stubGlobal('showSaveFilePicker', showSaveFilePicker);
	const view = setup({
		gallery: async () => new Response(source.replace('int value 1', '; @pos 4 10\n; @favorite\nint value 1')),
	});
	const editor = await view.mounted();
	const canvas = view.panel().querySelector('canvas')!;
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	canvas.style.width = '640px';
	canvas.style.height = '400px';
	await vi.waitFor(() => expect(editor.state.viewport.width).toBe(640));
	await vi.waitFor(() => expect(editor.state.compiler.result.compiledModules.galleryExample).toBeDefined());
	expect(editor.state.editorMode).toBe('edit');
	const rect = canvas.getBoundingClientRect();
	canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: rect.x + 600, clientY: rect.y + 100, bubbles: true }));
	await vi.waitFor(() =>
		expect(editor.state.contextMenu.items.some(item => item.action === 'createCodeBlock')).toBe(true)
	);
	const menu = editor.state.contextMenu.items;
	for (const action of ['new', 'importProject', 'exportWasm', 'exportCanvasScreenshot', 'loadPluginsUsedByProject']) {
		expect(menu.some(item => item.action === action)).toBe(false);
	}
	expect(menu.some(item => item.action === 'exportProject')).toBe(true);
	expect(menu.some(item => item.action === 'pasteCodeBlocks')).toBe(true);
	expect(menu.some(item => item.title === 'Add Built-in Block')).toBe(false);
	expect(menu.some(item => item.payload?.menu === 'favoritesMenu')).toBe(false);
	const exportIndex = menu.findIndex(item => item.action === 'exportProject');
	const x = rect.x + editor.state.contextMenu.x - editor.state.viewport.x + 8;
	const y =
		rect.y + editor.state.contextMenu.y - editor.state.viewport.y + exportIndex * editor.state.viewport.hGrid + 8;
	canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
	canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
	await vi.waitFor(() => expect(writable.close).toHaveBeenCalledOnce());
	expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'project.8f4e' }));
	const exportedSource = await (writable.write.mock.calls[0][0] as Blob).text();
	expect(exportedSource).toContain('module galleryExample');
	expect(exportedSource).toContain('int value 1');
	expect(editor.state.contextMenu.open).toBe(false);
	const saveKey = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
	canvas.dispatchEvent(saveKey);
	expect(saveKey.defaultPrevented).toBe(true);
	await vi.waitFor(() => expect(writable.close).toHaveBeenCalledTimes(2));
	expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
	expect(showSaveFilePicker).toHaveBeenCalledOnce();
});

test('loads and runs worker and test runtime plugins together through the gallery composition', async () => {
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
	const memory = editor.state.compiler.result.memoryPlan.modules.counter.memory.count;
	await vi.waitFor(() => expect(editor.getMemoryViews().int32[memory.allocationUnitAddress]).toBeGreaterThan(2));
	expect(editor.state.codeErrors.compiler).toEqual([]);
	expect(editor.state.codeErrors['editor-directives']).toEqual([]);
	expect(editor.state.envConstantContributions.workerRuntime).toEqual(['const CONTROL_RATE 50']);
});

test('compiles a loaded project through the compiler plugin and refreshes editor memory views', async () => {
	const configuredSource = source.replace('int value 1', '; @config recompileDebounceDelay 10\nint value 1');
	const view = setup({ compiled: async () => new Response(configuredSource) });
	const editor = await view.mounted();
	await vi.waitFor(
		() =>
			expect(Object.keys(editor.state.compiler.result.compiledModules).some(id => id.includes('galleryExample'))).toBe(
				true
			),
		{ timeout: 10000 }
	);
	expect(editor.state.codeErrors.compiler).toEqual([]);
	expect(editor.state.codeErrors['editor-directives']).toEqual([]);
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
	await vi.waitFor(() => expect(editor.state.compiler.result.memoryPlan.modules.controls).toBeDefined(), {
		timeout: 10000,
	});
	const state = editor.state;
	const block = state.project.activeLevel.blocks.find(block => block.name === 'controls')!;
	await vi.waitFor(
		() => expect([10, 11, 12, 13, 14, 15].map(row => block.gaps.get(row)?.size)).toEqual([2, 1, 8, 6, 2, 2]),
		{ timeout: 10000 }
	);
	expect(state.codeErrors.compiler).toEqual([]);
	const canvas = view.panel().querySelector('canvas')!;
	const address = state.compiler.result.memoryPlan.modules.controls.memory.value.allocationUnitAddress;
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
	await expect(view.mounted()).rejects.toThrow('Offline');
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	await vi.waitFor(() => expect(status.textContent).toContain('This project could not be loaded.'));
	expect(view.panel().querySelector('canvas')).toBeNull();
	status.querySelector<HTMLButtonElement>('button')!.click();
	await view.mounted(1);
	await vi.waitFor(() => expect(view.panel().querySelector('canvas')?.classList.contains('editor-ready')).toBe(true));
	expect(status.hidden).toBe(true);
});

test('reports a rejected mount without revealing the editor', async () => {
	let fail!: (error: Error) => void;
	const pending = new Promise<GalleryEditorInstance>((_, reject) => {
		fail = reject;
	});
	vi.mocked(mountGalleryEditor).mockImplementationOnce(() => pending);
	const view = setup({ fontFailure: async () => new Response(source) });
	await view.started();
	const canvas = view.panel().querySelector('canvas')!;
	await new Promise(requestAnimationFrame);
	expect(canvas.classList.contains('editor-ready')).toBe(false);
	const error = new Error('Font unavailable');
	fail(error);
	await expect(view.mounted()).rejects.toBe(error);
	await vi.waitFor(() => expect(canvas.isConnected).toBe(false));
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	expect(status.hidden).toBe(false);
	expect(status.textContent).toContain('This project could not be loaded.');
});

test.each(['fulfilled', 'rejected'])('ignores a %s mount after the gallery is disposed', async outcome => {
	let finish!: (editor: GalleryEditorInstance) => void;
	let fail!: (error: Error) => void;
	const pending = new Promise<GalleryEditorInstance>((resolve, reject) => {
		finish = resolve;
		fail = reject;
	});
	const disposeEditor = vi.fn();
	vi.mocked(mountGalleryEditor).mockImplementationOnce(() => pending);
	const view = setup({ pending: async () => new Response(source) });
	await view.started();
	const canvas = view.panel().querySelector('canvas')!;
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	view.dispose();
	expect(canvas.isConnected).toBe(false);

	if (outcome === 'fulfilled') {
		finish({ dispose: disposeEditor } as unknown as GalleryEditorInstance);
		await vi.waitFor(() => expect(disposeEditor).toHaveBeenCalledOnce());
	} else {
		const error = new Error('Late failure');
		fail(error);
		await expect(view.mounted()).rejects.toBe(error);
		await new Promise(requestAnimationFrame);
		expect(disposeEditor).not.toHaveBeenCalled();
	}
	expect(canvas.classList.contains('editor-ready')).toBe(false);
	expect(status.textContent).toBe('Loading project…');
	expect(status.hidden).toBe(false);
});

test('retries a timed-out pending mount without reviving its late completion', async () => {
	let finish!: (editor: GalleryEditorInstance) => void;
	const pending = new Promise<GalleryEditorInstance>(resolve => {
		finish = resolve;
	});
	const disposeEditor = vi.fn();
	const timeouts = vi.spyOn(window, 'setTimeout');
	const clearTimeout = vi.spyOn(window, 'clearTimeout');
	vi.mocked(mountGalleryEditor).mockImplementationOnce(() => pending);
	const view = setup({ timeout: async () => new Response(source) });
	await view.started();
	const timeoutIndex = timeouts.mock.calls.findIndex(([, delay]) => delay === 30_000);
	await new Promise(requestAnimationFrame);
	expect(clearTimeout).not.toHaveBeenCalledWith(timeouts.mock.results[timeoutIndex].value);
	expect(view.panel().querySelector('canvas')?.classList.contains('editor-ready')).toBe(false);
	const timeout = timeouts.mock.calls[timeoutIndex][0] as () => void;
	timeout();
	expect(clearTimeout).toHaveBeenCalledWith(timeouts.mock.results[timeoutIndex].value);
	expect(view.panel().querySelector('canvas')).toBeNull();
	const status = view.panel().querySelector<HTMLElement>('[role="status"]')!;
	expect(status.textContent).toContain('This project could not be loaded.');
	status.querySelector<HTMLButtonElement>('button')!.click();
	await view.mounted(1);
	await vi.waitFor(() => expect(view.panel().querySelector('canvas')?.classList.contains('editor-ready')).toBe(true));

	finish({ dispose: disposeEditor } as unknown as GalleryEditorInstance);
	await vi.waitFor(() => expect(disposeEditor).toHaveBeenCalledOnce());
	expect(status.hidden).toBe(true);
	expect(view.panel().querySelector('button')).toBeNull();
	expect(view.panel().querySelectorAll('canvas')).toHaveLength(1);
});

test('switches examples without waiting for the previous fetch and ignores its late completion', async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup({ first: () => pending, second: async () => new Response(source) });
	await view.started();
	const firstCanvas = view.panel('first').querySelector('canvas')!;
	view.gallery.querySelector<HTMLButtonElement>('#example-second')!.click();
	await view.mounted(1);
	await vi.waitFor(() =>
		expect(view.panel('second').querySelector('canvas')?.classList.contains('editor-ready')).toBe(true)
	);
	expect(firstCanvas.isConnected).toBe(false);
	finish(new Response(source));
	await vi.mocked(mountGalleryEditor).mock.results[0].value;
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
	await view.started();
	expect(tools.size).toBe(0);
	finish(new Response(source));
	await view.mounted();
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
	expect(editor.state.project.activeLevel.blocks.find(block => block.blockType === 'module')!.code[0]).toBe(
		'module secondExample ; @mode edit'
	);
	expect(await tools.get('get_project')!.execute({})).toContain('module secondExample');
	expect(await tools.get('apply_edits')!.execute(args)).toBe('Edits applied.');
	expect(editor.state.project.activeLevel.blocks.filter(block => block.blockType === 'module')).toHaveLength(0);
	expect(tools.size).toBe(18);
});

test('creates group templates while editing and saves the rightmost copy for reopening', async () => {
	let projectSource = `8f4e/v1
note
; @mode edit
; @config recompileDebounceDelay 10
noteEnd
entry main
group left
; @pos 0 0
expose value &counter:value
entry main
module counter
int value 1
moduleEnd
entryEnd
groupEnd
group right
; @pos 20 0
expose value &counter:value
entry main
module counter
int value 2
moduleEnd
entryEnd
groupEnd
entryEnd`;
	const writable = {
		write: vi.fn(async (blob: Blob) => {
			projectSource = await blob.text();
		}),
		close: vi.fn(),
		abort: vi.fn(),
	};
	vi.stubGlobal(
		'showSaveFilePicker',
		vi.fn().mockResolvedValue({ createWritable: async () => writable, requestPermission: async () => 'granted' })
	);
	const view = setup({ templates: async () => new Response(projectSource), other: async () => new Response(source) });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(editor.state.compiler.result.memoryPlan.modules['right/counter']).toBeDefined(), {
		timeout: 10000,
	});
	const [left, right] = ['left', 'right'].map(
		name => editor.state.project.rootLevel.blocks.find(block => block.name === name)!
	);
	editor.editing.applyEdits({
		expectedRevision: editor.editing.getRevision(),
		edits: [left, right].map(block => ({
			type: 'update' as const,
			blockId: getEditorBlockId(block),
			code: [`${block.code[0]} use counter`, ...block.code.slice(1)],
		})),
	});
	editor.navigation.openGroup(getEditorBlockId(right));
	const counter = editor.state.project.activeLevel.blocks.find(block => block.name === 'counter')!;
	editor.editing.applyEdits({
		expectedRevision: editor.editing.getRevision(),
		edits: [
			{ type: 'update', blockId: getEditorBlockId(counter), code: ['module counter', 'int value 22', 'moduleEnd'] },
		],
	});
	editor.navigation.goToRoot();
	const save = async (count: number) => {
		const canvas = view.panel('templates').querySelector('canvas')!;
		// Compilation can finish before the deferred save plugin starts handling shortcuts.
		await vi.waitFor(
			() => {
				const shortcut = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
				canvas.dispatchEvent(shortcut);
				expect(shortcut.defaultPrevented).toBe(true);
			},
			{ timeout: 10000 }
		);
		await vi.waitFor(() => expect(writable.close).toHaveBeenCalledTimes(count));
	};
	await save(1);
	expect(projectSource.match(/^template counter$/gm)).toHaveLength(1);
	expect(projectSource.match(/^group (left|right) use counter$/gm)).toHaveLength(2);
	expect(projectSource).toContain('int value 22');
	expect(projectSource).not.toContain('int value 1');
	const moved = editor.state.project.rootLevel.blocks.find(block => block.name === 'left')!;
	editor.editing.applyEdits({
		expectedRevision: editor.editing.getRevision(),
		edits: [
			{
				type: 'update',
				blockId: getEditorBlockId(moved),
				code: moved.code.map(line => (line.startsWith('; @pos') ? '; @pos 40 0' : line)),
			},
		],
	});
	await save(2);
	expect(projectSource).toContain('int value 1');
	expect(projectSource).not.toContain('int value 22');
	view.gallery.querySelector<HTMLButtonElement>('#example-other')!.click();
	await view.mounted(1);
	view.gallery.querySelector<HTMLButtonElement>('#example-templates')!.click();
	const reopened = await view.mounted(2);
	await vi.waitFor(
		() => expect(reopened.state.compiler.result.memoryDefaultsByModuleId['left/counter']?.[0].value).toBe(1),
		{ timeout: 10000 }
	);
	expect(reopened.state.compiler.result.memoryDefaultsByModuleId['right/counter'][0].value).toBe(1);
	expect(reopened.state.codeErrors.compiler).toEqual([]);
	expect(reopened.state.codeErrors['editor-directives']).toEqual([]);
});

test('loads an example without a generated preview and omits its image', async () => {
	const previewUrl = getExampleProjectPreviewUrl('audio/not-yet-generated.8f4e');
	expect(previewUrl).toBeUndefined();
	const view = setup({ unpreviewed: async () => new Response(source) }, { previewUrl });
	const editor = await view.mounted();
	await vi.waitFor(() => expect(view.panel().querySelector('canvas')?.classList.contains('editor-ready')).toBe(true));
	expect(view.gallery.querySelector('.example-preview')).toBeNull();
	expect(view.gallery.querySelector('.example-title')?.textContent).toBe('unpreviewed');
	expect(
		editor.state.project.rootLevel.blocks.find(block => block.name === 'galleryExample')?.code.join('\n')
	).toContain('module galleryExample');
});
