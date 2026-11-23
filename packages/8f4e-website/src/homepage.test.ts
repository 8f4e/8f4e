import { type LandingEditorInstance, mountLandingEditor } from '@8f4e/editor-landing';
import type {} from '@vitest/browser-playwright';
import { afterEach, expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { mountHomepageEditors } from './homepage';
import { getHomepageProjectUrl } from './homepage-projects';

vi.mock('@8f4e/editor-landing', { spy: true });

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

function setup(response?: () => Promise<Response>) {
	const row = document.createElement('div');
	row.className = 'editor-row';
	const frame = document.createElement('div');
	frame.className = 'editor-frame';
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 320;
	canvas.style.width = '640px';
	canvas.style.height = '320px';
	if (response) {
		const path = 'misc/landingPageDemo1.8f4e';
		canvas.dataset.projectPath = path;
		const url = getHomepageProjectUrl(path);
		const fetch = globalThis.fetch.bind(globalThis);
		vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) =>
			input === url ? response() : fetch(input, options)
		);
	}
	frame.append(canvas);
	row.append(frame);
	document.body.append(row);
	const dispose = mountHomepageEditors();
	cleanups.push(() => {
		dispose();
		row.remove();
	});
	const started = async () => {
		await vi.waitFor(() => expect(mountLandingEditor).toHaveBeenCalledOnce());
	};
	const mounted = async () => {
		await started();
		return await vi.mocked(mountLandingEditor).mock.results[0].value;
	};
	return { canvas, frame, started, mounted, dispose };
}

test('reveals the homepage editor after its initial project load completes', async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup(() => pending);
	await view.started();
	expect(view.canvas.classList.contains('editor-ready')).toBe(false);
	finish(new Response('8f4e/v1'));
	await view.mounted();
	await vi.waitFor(() => expect(view.canvas.classList.contains('editor-ready')).toBe(true));
});

test.each([false, true])('waits for the editor mount and respects disposal (disposed=%s)', async disposed => {
	let finish!: (editor: LandingEditorInstance) => void;
	const pending = new Promise<LandingEditorInstance>(resolve => {
		finish = resolve;
	});
	const editor = {
		dispose: vi.fn(),
		pauseRendering: vi.fn(),
		resumeRendering: vi.fn(),
		releaseRenderingResources: vi.fn(),
	} as unknown as LandingEditorInstance;
	vi.mocked(mountLandingEditor).mockImplementationOnce(() => pending);
	const view = setup(async () => new Response('8f4e/v1'));
	await view.started();
	await new Promise(requestAnimationFrame);
	expect(view.canvas.classList.contains('editor-ready')).toBe(false);

	if (disposed) view.dispose();
	finish(editor);
	await view.mounted();
	if (disposed) {
		expect(editor.dispose).toHaveBeenCalledOnce();
		await new Promise(requestAnimationFrame);
		expect(view.canvas.classList.contains('editor-ready')).toBe(false);
	} else {
		await vi.waitFor(() => expect(view.canvas.classList.contains('editor-ready')).toBe(true));
	}
});

test('reports a rejected renderer mount without revealing the editor', async () => {
	let fail!: (error: Error) => void;
	const pending = new Promise<LandingEditorInstance>((_, reject) => {
		fail = reject;
	});
	vi.mocked(mountLandingEditor).mockImplementationOnce(() => pending);
	const view = setup(async () => new Response('8f4e/v1'));
	await view.started();
	await new Promise(requestAnimationFrame);
	expect(view.canvas.classList.contains('editor-ready')).toBe(false);
	const error = new Error('Font unavailable');
	fail(error);
	await expect(view.mounted()).rejects.toBe(error);
	await vi.waitFor(() =>
		expect(view.frame.querySelector('[role="alert"]')?.textContent).toContain('This project could not be loaded.')
	);
	expect(view.canvas.classList.contains('editor-ready')).toBe(false);
});

test('reports URL loading failures on the homepage without revealing an empty editor', async () => {
	const view = setup(async () => {
		throw new Error('Offline');
	});
	await view.mounted();
	await vi.waitFor(() =>
		expect(view.frame.querySelector('[role="alert"]')?.textContent).toContain('This project could not be loaded.')
	);
	expect(view.canvas.classList.contains('editor-ready')).toBe(false);
});

test('reveals an initialized empty editor when no project URL is supplied', async () => {
	const view = setup();
	const editor = await view.mounted();
	await vi.waitFor(() => expect(view.canvas.classList.contains('editor-ready')).toBe(true));
	expect(editor.state.initialProjectState.execution).toEqual([]);
	const enterEdit = new KeyboardEvent('keydown', { key: 'e', cancelable: true });
	view.canvas.dispatchEvent(enterEdit);
	expect(enterEdit.defaultPrevented).toBe(false);
	expect(editor.state.editorMode).toBe('view');
});

test.each(['release', 'blur'])('continues panning a homepage demo outside its canvas until %s', async end => {
	const view = setup();
	const editor = await view.mounted();
	await vi.waitFor(() => expect(view.canvas.classList.contains('editor-ready')).toBe(true));
	await vi.dynamicImportSettled();

	const { x, y } = editor.state.viewport;
	const rect = view.canvas.getBoundingClientRect();
	const frame = window.frameElement!.getBoundingClientRect();
	const point = (dx: number, dy: number) => ({
		x: frame.left + rect.right - 35 + dx,
		y: frame.top + rect.top + 80 + dy,
	});
	const mouse = cdp();
	const panned = { x: x - 74, y: y - 11 };
	await mouse.send('Input.dispatchMouseEvent', { type: 'mouseMoved', buttons: 0, ...point(0, 0) });
	await mouse.send('Input.dispatchMouseEvent', {
		type: 'mousePressed',
		button: 'left',
		buttons: 1,
		clickCount: 1,
		...point(0, 0),
	});
	try {
		await mouse.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, ...point(20, 5) });
		expect(editor.state.viewport).toMatchObject({ x: x - 20, y: y - 5 });
		await mouse.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, ...point(74, 11) });
		expect(editor.state.viewport).toMatchObject(panned);
		if (end === 'blur') {
			window.dispatchEvent(new Event('blur'));
			expect(editor.state.viewport).toMatchObject(panned);
		}
	} finally {
		await mouse.send('Input.dispatchMouseEvent', {
			type: 'mouseReleased',
			button: 'left',
			buttons: 0,
			clickCount: 1,
			...point(74, 11),
		});
	}
	expect(editor.state.viewport).toMatchObject(panned);
	await mouse.send('Input.dispatchMouseEvent', { type: 'mouseMoved', buttons: 0, ...point(10, 50) });
	expect(editor.state.viewport).toMatchObject(panned);
});

test('keeps touch panning horizontal on the homepage', async () => {
	const input = cdp();
	await input.send('Emulation.setTouchEmulationEnabled', { enabled: true });
	try {
		const view = setup();
		const editor = await view.mounted();
		await expect.poll(() => view.canvas.style.touchAction).toBe('pan-y');
		const { x, y } = editor.state.viewport;
		const rect = view.canvas.getBoundingClientRect();
		const frame = window.frameElement!.getBoundingClientRect();
		const point = (dx: number, dy: number) => ({
			x: frame.left + rect.left + 100 + dx,
			y: frame.top + rect.top + 100 + dy,
		});
		await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(0, 0)] });
		try {
			await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(37, 4)] });
			expect(editor.state.viewport).toMatchObject({ x: x - 37, y });
		} finally {
			await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		}
		expect(editor.state.viewport).toMatchObject({ x: x - 37, y });
	} finally {
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});

test('runs landing-page projects without opening an invisible context menu', async () => {
	const view = setup(
		async () =>
			new Response(`8f4e/v1
note settings ; @mode edit
; @config recompileDebounceDelay 10
; @config workerRuntime.enabled true
; @config workerRuntime.sampleRate 50
noteEnd
entry main
module counter
; @pos 2 2
int value 0 ; @watch
push &value
push value
push 1
add
store
moduleEnd
entryEnd`)
	);
	const editor = await view.mounted();
	await vi.waitFor(() => expect(editor.getCompilerDiagnostics()?.status).toBe('ready'), { timeout: 10000 });
	await vi.waitFor(
		() => {
			const value = editor.state.compiler.result.memoryPlan.modules.counter.memory.value;
			expect(editor.getMemoryViews().int32[value.allocationUnitAddress]).toBeGreaterThan(0);
		},
		{ timeout: 10000 }
	);
	await vi.dynamicImportSettled();
	expect(editor.state.editorMode).toBe('edit');
	const leaveEdit = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
	view.canvas.dispatchEvent(leaveEdit);
	expect(leaveEdit.defaultPrevented).toBe(false);
	expect(editor.state.editorMode).toBe('edit');
	const contextMenu = new MouseEvent('contextmenu', { clientX: 30, clientY: 30, cancelable: true });
	view.canvas.dispatchEvent(contextMenu);
	expect(contextMenu.defaultPrevented).toBe(true);
	expect(editor.state.contextMenu.open).toBe(false);
	expect(editor.state.codeErrors.compiler).toEqual([]);
	for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
		const save = new KeyboardEvent('keydown', { key: 's', ...modifier, cancelable: true });
		view.canvas.dispatchEvent(save);
		expect(save.defaultPrevented).toBe(false);
	}
});
