import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupPlugin } from './__tests__/setup';
import { createProjectUrlLoaderPlugin } from './index';

const cleanups: Array<() => void> = [];
const url = 'https://example.com/project.8f4e';
const source = '8f4e/v1\nentry main\nmodule remote\nmoduleEnd\nentryEnd';
function setup(
	fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(source)),
	initialProjectUrl?: string
) {
	const onLoaded = vi.fn();
	const onError = vi.fn();
	const test = setupPlugin(createProjectUrlLoaderPlugin({ fetch, initialProjectUrl, onLoaded, onError }));
	cleanups.push(test.dispose);
	test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	return { ...test, fetch, onLoaded, onError };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('project URL loader plugin', () => {
	it('loads an explicit initial URL through the generic initialization hook', async () => {
		const test = setup(undefined, url);
		test.onLoaded.mockImplementation(() => {
			expect(test.state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'remote')).toBe(true);
		});
		expect(test.fetch).not.toHaveBeenCalled();
		test.events.dispatch('init');
		await vi.waitFor(() =>
			expect(test.state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'remote')).toBe(true)
		);
		expect(test.fetch).toHaveBeenCalledWith(url, { cache: 'no-store' });
		expect(test.onLoaded).toHaveBeenCalledOnce();
		expect(test.onError).not.toHaveBeenCalled();
	});

	it('does no startup fetch or notification when there is no initial URL', async () => {
		const test = setup();
		await test.dispatchAsync('init');
		expect(test.fetch).not.toHaveBeenCalled();
		expect(test.onLoaded).not.toHaveBeenCalled();
		expect(test.onError).not.toHaveBeenCalled();
	});

	it.each([
		['HTTP failure', () => Promise.resolve(new Response('Not found', { status: 404 }))],
		['invalid source', () => Promise.resolve(new Response('invalid project'))],
		['network failure', () => Promise.reject(new Error('Offline'))],
	])('reports %s and loads an empty project', async (_name, response) => {
		const fetch = vi.fn<typeof globalThis.fetch>(response);
		const test = setup(fetch, url);
		test.events.dispatch('init');
		await vi.waitFor(() =>
			expect(test.state.console.logs.some(log => log.message.includes('Failed to load project'))).toBe(true)
		);
		expect(test.state.initialProjectState).toMatchObject({ execution: [], notes: [] });
		expect(test.onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
		expect(test.onLoaded).not.toHaveBeenCalled();
	});

	it('reports an empty project as successfully loaded', async () => {
		const test = setup(vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('8f4e/v1')), url);
		await test.dispatchAsync('init');
		expect(test.onLoaded).toHaveBeenCalledOnce();
		expect(test.onError).not.toHaveBeenCalled();
		expect(test.state.initialProjectState).toMatchObject({ execution: [], notes: [] });
	});

	it('removes its startup listener on disposal', () => {
		const test = setup(undefined, url);
		test.disposePlugin();
		test.events.dispatch('init');
		expect(test.fetch).not.toHaveBeenCalled();
	});

	it.each(['success', 'failure'])('ignores a fetch %s after disposal', async result => {
		let finish!: (response: Response) => void;
		let fail!: (error: Error) => void;
		const pending = new Promise<Response>((resolve, reject) => {
			finish = resolve;
			fail = reject;
		});
		const test = setup(
			vi.fn<typeof globalThis.fetch>(() => pending),
			url
		);
		const loading = test.dispatchAsync('init');
		test.disposePlugin();
		if (result === 'success') finish(new Response(source));
		else fail(new Error('Offline'));
		await loading;
		expect(test.onLoaded).not.toHaveBeenCalled();
		expect(test.onError).not.toHaveBeenCalled();
		expect(test.fetch).toHaveBeenCalledOnce();
		expect(test.state.initialProjectState).toMatchObject({ execution: [], notes: [] });
	});
});
