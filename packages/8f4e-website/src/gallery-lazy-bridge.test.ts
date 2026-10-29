import { mountMinimalEditor } from '@8f4e/editor-minimal';
import type { WebMcpTool } from '@8f4e/editor-webmcp';
import { expect, test, vi } from 'vitest';
import { mountGallery } from './gallery';

const bridgeLoading = vi.hoisted(() => {
	let finish!: () => void;
	const promise = new Promise<void>(resolve => {
		finish = resolve;
	});
	return { promise, finish: () => finish() };
});

vi.mock('@8f4e/editor-minimal', { spy: true });
vi.mock('@8f4e/editor-webmcp', async importOriginal => {
	await bridgeLoading.promise;
	return importOriginal();
});

test('reveals and switches editors while the bridge loads, then connects only the current editor', async () => {
	const tools = new Map<string, WebMcpTool>();
	const originalContext = Object.getOwnPropertyDescriptor(document, 'modelContext');
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
	const originalUrl = window.location.href;
	window.history.replaceState(null, '', '#first');
	const fetch = globalThis.fetch.bind(globalThis);
	vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
		const id = ['first', 'second'].find(id => input === `/lazy-${id}.8f4e`);
		return id
			? Promise.resolve(new Response(`8f4e/v1\nentry main\nmodule ${id}Example\nmoduleEnd\nentryEnd`))
			: fetch(input, options);
	});
	const gallery = document.createElement('div');
	gallery.id = 'examples-gallery';
	document.body.append(gallery);
	const dispose = mountGallery({
		title: 'Examples',
		categories: [
			{
				path: 'test',
				title: 'Test',
				projects: ['first', 'second'].map(id => ({
					id,
					title: id,
					description: 'Bridge loading fixture.',
					projectUrl: `/lazy-${id}.8f4e`,
					previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
					githubUrl: 'https://github.com/8f4e/8f4e',
				})),
			},
		],
	});
	try {
		await vi.waitFor(() =>
			expect(gallery.querySelector('#panel-first canvas')?.classList.contains('editor-ready')).toBe(true)
		);
		expect(mountMinimalEditor).toHaveBeenCalledOnce();
		expect(tools.size).toBe(0);
		const firstCanvas = gallery.querySelector('#panel-first canvas')!;
		gallery.querySelector<HTMLButtonElement>('#example-second')!.click();
		await vi.waitFor(() =>
			expect(gallery.querySelector('#panel-second canvas')?.classList.contains('editor-ready')).toBe(true)
		);
		expect(mountMinimalEditor).toHaveBeenCalledTimes(2);
		expect(firstCanvas.isConnected).toBe(false);
		expect(tools.size).toBe(0);
		bridgeLoading.finish();
		await vi.waitFor(() => expect(tools.has('get_project')).toBe(true));
		expect(await tools.get('get_project')!.execute({})).toContain('module secondExample');
	} finally {
		dispose();
		bridgeLoading.finish();
		gallery.remove();
		window.history.replaceState(null, '', originalUrl);
		if (originalContext) Object.defineProperty(document, 'modelContext', originalContext);
		else Reflect.deleteProperty(document, 'modelContext');
		vi.restoreAllMocks();
	}
	expect(tools.size).toBe(0);
});
