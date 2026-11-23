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
	const onError = vi.fn();
	const test = setupPlugin(createProjectUrlLoaderPlugin({ fetch, initialProjectUrl, onError }));
	cleanups.push(test.dispose);
	test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	return { ...test, fetch, onError };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('project URL loader plugin', () => {
	it('finishes loading an explicit initial URL during source preparation', async () => {
		const test = setup(undefined, url);
		expect(test.fetch).not.toHaveBeenCalled();
		const preparing = test.dispatchAsync('prepareInitialProject');
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'project-url', message: 'Loading project...', status: 'loading' },
		]);
		await preparing;
		expect(test.state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'remote')).toBe(true);
		expect(test.fetch).toHaveBeenCalledWith(url, { cache: 'no-store' });
		expect(test.state.loadingIndicators).toMatchObject([{ id: 'project-url', status: 'done' }]);
		expect(test.onError).not.toHaveBeenCalled();
	});

	it('does not fetch or report an error when there is no initial URL', async () => {
		const test = setup();
		await test.dispatchAsync('prepareInitialProject');
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		expect(test.fetch).not.toHaveBeenCalled();
		expect(test.onError).not.toHaveBeenCalled();
	});

	it.each([
		['HTTP failure', () => Promise.resolve(new Response('Not found', { status: 404 }))],
		['invalid source', () => Promise.resolve(new Response('invalid project'))],
		['network failure', () => Promise.reject(new Error('Offline'))],
	])('reports %s and loads an empty project', async (_name, response) => {
		const fetch = vi.fn<typeof globalThis.fetch>(response);
		const test = setup(fetch, url);
		await test.dispatchAsync('prepareInitialProject');
		expect(test.state.console.logs.some(log => log.message.includes('Failed to load project'))).toBe(true);
		expect(test.state.initialProjectState).toMatchObject({
			entries: [],
			execution: [],
			notes: [],
		});
		expect(test.onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
		expect(test.state.loadingIndicators).toMatchObject([{ id: 'project-url', status: 'failed' }]);
	});

	it('successfully installs a valid empty project', async () => {
		const test = setup(vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('8f4e/v1')), url);
		test.events.dispatch('loadProject', {
			project: { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code: ['note previous', 'noteEnd'] }] },
		});
		await test.dispatchAsync('prepareInitialProject');
		expect(test.state.loadingIndicators).toMatchObject([{ id: 'project-url', status: 'done' }]);
		expect(test.onError).not.toHaveBeenCalled();
		expect(test.state.initialProjectState).toMatchObject({
			entries: [],
			execution: [],
			notes: [],
		});
	});

	it('removes its startup listener on disposal', () => {
		const test = setup(undefined, url);
		test.disposePlugin();
		test.events.dispatch('prepareInitialProject');
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
		const loading = test.dispatchAsync('prepareInitialProject');
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toMatchObject([
			{ id: 'project-url', message: 'Loading project...', status: 'loading' },
		]);
		test.disposePlugin();
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		if (result === 'success') finish(new Response(source));
		else fail(new Error('Offline'));
		await loading;
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		expect(test.onError).not.toHaveBeenCalled();
		expect(test.fetch).toHaveBeenCalledOnce();
		expect(test.state.initialProjectState).toMatchObject({
			entries: [],
			execution: [],
			notes: [],
		});
	});
});
