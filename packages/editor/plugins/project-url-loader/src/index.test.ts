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
	const test = setupPlugin(createProjectUrlLoaderPlugin({ fetch, initialProjectUrl }));
	cleanups.push(test.dispose);
	test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	return { ...test, fetch };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('project URL loader plugin', () => {
	it('loads an explicit initial URL through the generic initialization hook', async () => {
		const test = setup(undefined, url);
		expect(test.fetch).not.toHaveBeenCalled();
		test.events.dispatch('init');
		await vi.waitFor(() =>
			expect(test.state.codeBlockRendering.codeBlocks.some(block => block.name === 'remote')).toBe(true)
		);
		expect(test.fetch).toHaveBeenCalledWith(url, { cache: 'no-store' });
	});

	it('does no startup fetch when there is no initial URL', () => {
		const test = setup();
		test.events.dispatch('init');
		expect(test.fetch).not.toHaveBeenCalled();
	});

	it.each([url, url + '?version=2'])('loads a project on demand without changing its URL: %s', async projectUrl => {
		const test = setup();
		test.events.dispatch('loadProjectByUrl', { projectUrl });
		await vi.waitFor(() =>
			expect(test.state.codeBlockRendering.codeBlocks.some(block => block.name === 'remote')).toBe(true)
		);
		expect(test.fetch).toHaveBeenCalledWith(projectUrl, { cache: 'no-store' });
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
		expect(test.state.initialProjectState).toMatchObject({ modules: [], notes: [], groups: [] });
	});

	it('removes its startup and explicit-load listeners on disposal', () => {
		const test = setup(undefined, url);
		test.disposePlugin();
		test.events.dispatch('init');
		test.events.dispatch('loadProjectByUrl', { projectUrl: url });
		expect(test.fetch).not.toHaveBeenCalled();
	});

	it('ignores a fetch that finishes after disposal', async () => {
		let finish!: (response: Response) => void;
		const pending = new Promise<Response>(resolve => {
			finish = resolve;
		});
		const test = setup(vi.fn<typeof globalThis.fetch>(() => pending));
		const loading = test.dispatchAsync('loadProjectByUrl', { projectUrl: url });
		test.disposePlugin();
		finish(new Response(source));
		await loading;
		expect(test.fetch).toHaveBeenCalledOnce();
		expect(test.state.initialProjectState).toMatchObject({ modules: [], notes: [], groups: [] });
	});
});
