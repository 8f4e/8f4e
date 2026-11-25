import { EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupPlugin } from './__tests__/setup';
import { createProjectUrlLoaderPlugin } from './index';

const cleanups: Array<() => void> = [];
const url = 'https://example.com/project.8f4e';
const source = '8f4e/v1\nentry main\nmodule remote\nmoduleEnd\nentryEnd';
const previousProject = { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code: ['note previous', 'noteEnd'] }] };
const failures = [
	['HTTP failure', () => Promise.resolve(new Response('Not found', { status: 404 }))],
	['invalid source', () => Promise.resolve(new Response('invalid project'))],
	['network failure', () => Promise.reject(new Error('Offline'))],
] as const;
function setup(
	fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(source)),
	initialProjectUrl?: string,
	failureMode?: Parameters<typeof createProjectUrlLoaderPlugin>[0]['failureMode']
) {
	const test = setupPlugin(createProjectUrlLoaderPlugin({ fetch, initialProjectUrl, failureMode }));
	cleanups.push(test.dispose);
	test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	return { ...test, fetch };
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
		expect(test.state.project.activeLevel.blocks.some(block => block.name === 'remote')).toBe(true);
		expect(test.fetch).toHaveBeenCalledWith(url, { cache: 'no-store' });
		expect(test.state.loadingIndicators).toMatchObject([{ id: 'project-url', status: 'done' }]);
	});

	it('does not fetch when there is no initial URL', async () => {
		const test = setup();
		await test.dispatchAsync('prepareInitialProject');
		expect(test.state.loadingIndicators.filter(indicator => indicator.status === 'loading')).toEqual([]);
		expect(test.fetch).not.toHaveBeenCalled();
	});

	it.each(failures)(
		'rejects source preparation for %s by default without installing a fallback',
		async (_name, response) => {
			const fetch = vi.fn<typeof globalThis.fetch>(response);
			const test = setup(fetch, url);
			test.events.dispatch('loadProject', { project: previousProject });
			await expect(test.dispatchAsync('prepareInitialProject')).rejects.toThrow();
			expect(serializeToProject(test.state)).toMatchObject({ notes: previousProject.notes });
			expect(test.state.console.logs.some(log => log.message.includes('Failed to load project'))).toBe(true);
			expect(test.state.loadingIndicators).toMatchObject([{ id: 'project-url', status: 'failed' }]);
		}
	);

	it.each(failures)('reports %s and loads an empty project when requested', async (_name, response) => {
		const fetch = vi.fn<typeof globalThis.fetch>(response);
		const test = setup(fetch, url, 'empty-project');
		test.events.dispatch('loadProject', { project: previousProject });
		await test.dispatchAsync('prepareInitialProject');
		expect(test.state.console.logs.some(log => log.message.includes('Failed to load project'))).toBe(true);
		expect(serializeToProject(test.state)).toMatchObject({
			entries: [],
			execution: [],
			notes: [],
		});
		expect(test.state.loadingIndicators).toMatchObject([{ id: 'project-url', status: 'failed' }]);
	});

	it('does not treat installation errors as source failures even with an empty-project fallback', async () => {
		const test = setup(undefined, url, 'empty-project');
		const error = new Error('Installation failed');
		const install = vi.fn(() => {
			throw error;
		});
		test.events.on('loadProject', install);
		await expect(test.dispatchAsync('prepareInitialProject')).rejects.toBe(error);
		expect(install).toHaveBeenCalledOnce();
		expect(test.state.console.logs.some(log => log.message.includes('Failed to load project'))).toBe(false);
		expect(test.state.loadingIndicators).toMatchObject([{ id: 'project-url', status: 'failed' }]);
	});

	it('successfully installs a valid empty project', async () => {
		const test = setup(vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('8f4e/v1')), url);
		test.events.dispatch('loadProject', { project: previousProject });
		await test.dispatchAsync('prepareInitialProject');
		expect(test.state.loadingIndicators).toMatchObject([{ id: 'project-url', status: 'done' }]);
		expect(serializeToProject(test.state)).toMatchObject({
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
		expect(test.state.console.logs.some(log => log.message.includes('Failed to load project'))).toBe(false);
		expect(test.fetch).toHaveBeenCalledOnce();
		expect(serializeToProject(test.state)).toMatchObject({
			entries: [],
			execution: [],
			notes: [],
		});
	});
});
