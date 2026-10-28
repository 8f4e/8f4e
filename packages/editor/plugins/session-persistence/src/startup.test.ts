import { parseProjectSource } from '@8f4e/compiler';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { expect, it, vi } from 'vitest';
import { setupPlugins } from './__tests__/setup';
import { createSessionPersistencePlugin } from './index';

it('allows an empty autosave while a URL loads, then saves the URL project without restoring the previous session', async () => {
	const source = '8f4e/v1\nentry main\nmodule remote\nmoduleEnd\nentryEnd';
	let saved = JSON.stringify(parseProjectSource('8f4e/v1\nentry main\nmodule oldSession\nmoduleEnd\nentryEnd'));
	const storage = {
		getItem: vi.fn(() => saved),
		setItem: vi.fn((_key: string, value: string) => {
			saved = value;
		}),
	};
	let finish!: (response: Response) => void;
	const pending = new Promise<Response>(resolve => {
		finish = resolve;
	});
	const fetch = vi.fn<typeof globalThis.fetch>(() => pending);
	const test = setupPlugins([
		createProjectUrlLoaderPlugin({ fetch, initialProjectUrl: 'https://example.com/project.8f4e' }),
		createSessionPersistencePlugin({ storage, storageKey: 'session', restoreOnStartup: false }),
	]);
	try {
		test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		test.events.dispatch('init');
		expect(storage.getItem).not.toHaveBeenCalled();
		expect(JSON.parse(saved).modules).toEqual([]);
		finish(new Response(source));
		await vi.waitFor(() => expect(JSON.parse(saved).modules[0]?.code).toContain('module remote'));
		expect(test.state.codeBlockRendering.codeBlocks.some(block => block.name === 'oldSession')).toBe(false);
	} finally {
		test.dispose();
	}
});
