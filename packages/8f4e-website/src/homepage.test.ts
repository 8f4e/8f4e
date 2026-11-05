import { mountLandingEditor } from '@8f4e/editor-landing';
import { afterEach, expect, test, vi } from 'vitest';
import { getExampleProjectUrl } from './example-projects';
import { mountHomepageEditors } from './homepage';

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
		const url = getExampleProjectUrl(path);
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
	return { canvas, frame, started, mounted };
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
