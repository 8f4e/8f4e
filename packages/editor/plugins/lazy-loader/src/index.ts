import type { CodeBlockGraphicData, EditorPlugin, ParsedDirectiveRecord } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';

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
		...collectProjectDirectives(block.nestedProjectCodeBlocks ?? []),
	]);
}

/** Loading is asynchronous; each loaded plugin still uses the ordinary synchronous setup contract. */
export function createLazyPluginLoaderPlugin(plugins: readonly LazyEditorPlugin[]): EditorPlugin {
	return {
		id: 'lazy-loader',
		setup: context => {
			const { store } = context;
			const installed = new Map<string, () => void>();
			const pending = new Set<string>();
			let disposed = false;
			let scanQueued = false;

			const activate = async (entry: LazyEditorPlugin) => {
				pending.add(entry.id);
				try {
					let plugin: EditorPlugin;
					try {
						plugin = await entry.load();
					} catch (error) {
						if (!disposed) logError(store.getState(), `Failed to load plugin ${entry.id}: ${String(error)}`);
						return;
					}
					if (disposed) return;
					installed.set(entry.id, plugin.setup(context));
				} finally {
					pending.delete(entry.id);
				}
			};
			const scan = () => {
				const { codeBlocks, rootCodeBlocks } = store.getState().codeBlockRendering;
				const directives = {
					view: codeBlocks.flatMap(block => block.parsedDirectives),
					project: collectProjectDirectives(rootCodeBlocks),
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
			store.subscribe('codeBlockRendering.codeBlocks', scheduleScan);
			scan();

			return () => {
				disposed = true;
				store.unsubscribe('projectChange', scheduleScan);
				store.unsubscribe('codeBlockRendering.codeBlocks', scheduleScan);
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
