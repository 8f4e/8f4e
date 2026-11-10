import type {
	CodeBlockGraphicData,
	EditorPlugin,
	LoadingIndicatorHandle,
	ParsedDirectiveRecord,
} from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';

export { createDeferredPluginLoaderPlugin } from './deferred';
export { hasConfig, hasDirective } from './hasDirective';

export interface LazyEditorPlugin {
	id: string;
	scope: 'view' | 'project';
	matches: (directives: readonly ParsedDirectiveRecord[]) => boolean;
	load: () => Promise<EditorPlugin>;
}

function collectProjectDirectives(blocks: readonly CodeBlockGraphicData[]): ParsedDirectiveRecord[] {
	return blocks.flatMap(block => [
		...block.parsedDirectives,
		...collectProjectDirectives(block.childProject?.blocks ?? []),
	]);
}

/** Loading is asynchronous; each loaded plugin still uses the ordinary synchronous setup contract. */
export function createLazyPluginLoaderPlugin(plugins: readonly LazyEditorPlugin[]): EditorPlugin {
	return {
		id: 'lazy-loader',
		setup: context => {
			const { store, loading } = context;
			const installed = new Map<string, () => void>();
			const pending = new Map<string, LoadingIndicatorHandle>();
			let disposed = false;
			let scanQueued = false;

			const activate = async (entry: LazyEditorPlugin) => {
				const indicator = loading.add({ id: `plugin:${entry.id}`, message: `Loading ${entry.id}...` });
				pending.set(entry.id, indicator);
				try {
					let plugin: EditorPlugin;
					try {
						plugin = await entry.load();
					} catch (error) {
						indicator.fail();
						if (!disposed) logError(store.getState(), `Failed to load plugin ${entry.id}: ${String(error)}`);
						return;
					}
					if (disposed) return;
					installed.set(entry.id, plugin.setup(context));
					indicator.done();
				} catch (error) {
					indicator.fail();
					throw error;
				} finally {
					pending.delete(entry.id);
					indicator.cancel();
				}
			};
			const scan = () => {
				const { currentProject, rootProject } = store.getState().codeBlockRendering;
				const directives = {
					view: currentProject.blocks.flatMap(block => block.parsedDirectives),
					project: collectProjectDirectives(rootProject.blocks),
				};
				for (const entry of plugins) {
					if (!installed.has(entry.id) && !pending.has(entry.id) && entry.matches(directives[entry.scope])) {
						void activate(entry);
					}
				}
			};
			const scheduleScan = () => {
				if (scanQueued || disposed) return;
				scanQueued = true;
				// Project edits may temporarily reset the view before restoring its group. Inspect the settled view.
				queueMicrotask(() => {
					scanQueued = false;
					if (!disposed) scan();
				});
			};
			store.subscribe('projectChange', scheduleScan);
			store.subscribe('codeBlockRendering.currentProject.blocks', scheduleScan);
			scan();

			return () => {
				disposed = true;
				store.unsubscribe('projectChange', scheduleScan);
				store.unsubscribe('codeBlockRendering.currentProject.blocks', scheduleScan);
				for (const indicator of pending.values()) indicator.cancel();
				pending.clear();
				const errors: unknown[] = [];
				for (const cleanup of [...installed.values()].reverse()) {
					try {
						cleanup();
					} catch (error) {
						errors.push(error);
					}
				}
				installed.clear();
				if (errors.length) throw new AggregateError(errors, 'Lazy plugin cleanup failed');
			};
		},
	};
}
