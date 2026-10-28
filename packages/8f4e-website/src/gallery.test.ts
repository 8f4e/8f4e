import { type DefaultEditorInstance, mountDefaultEditor } from '@8f4e/editor-default';
import { afterEach, expect, test, vi } from 'vitest';
import { mountGallery } from './gallery';

vi.mock('@8f4e/editor-default', { spy: true });

const source = '8f4e/v1\nentry main\nmodule galleryExample\nint value 1\nmoduleEnd\nentryEnd';
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
		storageNamespace: 'gallery-test',
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
		for (const id of ids) window.sessionStorage.removeItem(`project_8f4e-gallery-test-${id}`);
	});
	const panel = (id = ids[0]) => gallery.querySelector<HTMLElement>(`#panel-${id}`)!;
	const mounted = async (index = 0): Promise<DefaultEditorInstance> => {
		await vi.waitFor(() => expect(mountDefaultEditor).toHaveBeenCalledTimes(index + 1));
		return await vi.mocked(mountDefaultEditor).mock.results[index].value;
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
	expect(editor.state.initialProjectState?.modules[0].code).toContain('module galleryExample');
});

test('reveals a successfully loaded empty project', async () => {
	const view = setup({ empty: async () => new Response('8f4e/v1') });
	await view.mounted();
	const canvas = view.panel().querySelector('canvas')!;
	await vi.waitFor(() => expect(canvas.classList.contains('editor-ready')).toBe(true));
	expect(view.panel().querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(true);
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
	vi.mocked(mountDefaultEditor).mockImplementationOnce(async (_canvas, options) => {
		options?.onInitialProjectLoadError?.(new Error('Offline'));
		return { dispose } as unknown as DefaultEditorInstance;
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
