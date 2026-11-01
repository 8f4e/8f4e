import { mountMinimalEditor } from '@8f4e/editor-minimal';
import { afterEach, expect, test, vi } from 'vitest';
import { getExampleProjectUrl } from './example-projects';
import { mountHomepageEditors } from './homepage';

vi.mock('@8f4e/editor-minimal', { spy: true });

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
	const mounted = async () => {
		await vi.waitFor(() => expect(mountMinimalEditor).toHaveBeenCalledOnce());
		return await vi.mocked(mountMinimalEditor).mock.results[0].value;
	};
	return { canvas, frame, mounted };
}

test('reveals the homepage editor after its initial project load completes', async () => {
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const view = setup(() => pending);
	await view.mounted();
	expect(view.canvas.classList.contains('editor-ready')).toBe(false);
	finish(new Response('8f4e/v1'));
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
	expect(editor.state.initialProjectState.modules).toEqual([]);
});
