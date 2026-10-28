import { mountDefaultEditor } from '@8f4e/editor-default';
import { expect, test, vi } from 'vitest';
import { mountGallery } from './gallery';

vi.mock('@8f4e/editor-default', { spy: true });

test('keeps the gallery editor alive until its initial project URL finishes loading', async () => {
	const projectUrl = '/gallery-delayed-project.8f4e';
	const source = '8f4e/v1\nentry main\nmodule galleryExample\nint value 1\nmoduleEnd\nentryEnd';
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const fetch = globalThis.fetch.bind(globalThis);
	vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) =>
		input === projectUrl ? pending : fetch(input, options)
	);
	const originalUrl = window.location.href;
	window.history.replaceState(null, '', '#delayed');
	const gallery = document.createElement('div');
	gallery.id = 'examples-gallery';
	document.body.append(gallery);
	const dispose = mountGallery({
		title: 'Examples',
		storageNamespace: 'gallery-test',
		categories: [
			{
				path: 'test',
				title: 'Test',
				projects: [
					{
						id: 'delayed',
						title: 'Delayed project',
						description: 'Loads after editor startup.',
						projectUrl,
						previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
						githubUrl: 'https://github.com/8f4e/8f4e',
					},
				],
			},
		],
	});
	try {
		await vi.waitFor(() => expect(mountDefaultEditor).toHaveBeenCalledOnce());
		const editor = await vi.mocked(mountDefaultEditor).mock.results[0].value;
		const status = gallery.querySelector<HTMLElement>('[role="status"]')!;
		const canvas = gallery.querySelector('canvas')!;
		expect(status.textContent).toBe('Loading project…');
		expect(canvas.isConnected).toBe(true);
		expect(canvas.classList.contains('editor-ready')).toBe(false);
		finish(new Response(source));
		await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
		expect(status.hidden).toBe(true);
		expect(editor.state.initialProjectState?.modules[0].code).toContain('module galleryExample');
	} finally {
		dispose();
		gallery.remove();
		window.sessionStorage.removeItem('project_8f4e-gallery-test-delayed');
		window.history.replaceState(null, '', originalUrl);
		vi.restoreAllMocks();
	}
});
