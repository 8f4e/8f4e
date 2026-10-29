import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { expect, it, vi } from 'vitest';
import { lazyPlugins } from './lazy-plugins';

it('loads plot from the default registry after session restoration', async () => {
	const project = parseProjectSource(
		'8f4e/v1\nentry main\nmodule audio\nint[] points 4\n; @plot &points 4\nmoduleEnd\nentryEnd'
	);
	const storage = { getItem: () => JSON.stringify(project), setItem: vi.fn() };
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, runtimeRegistry: {} });
	const context = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createCodeBlockDrawerRegistry(),
	};
	const disposeSession = createSessionPersistencePlugin({
		storage,
		storageKey: 'session',
		restoreOnStartup: true,
	}).setup(context);
	const disposeLoader = createLazyPluginLoaderPlugin(lazyPlugins).setup(context);
	try {
		events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		events.dispatch('init');
		await vi.waitFor(() =>
			expect(
				store
					.getState()
					.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')
					?.gaps.get(2)?.size
			).toBe(8)
		);
	} finally {
		disposeLoader();
		disposeSession();
		store.dispose();
	}
});
