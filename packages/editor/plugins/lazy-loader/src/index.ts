import type { EditorPlugin } from '@8f4e/editor-core';
import { logError, serializeToProject } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';

export { hasDirective } from './hasDirective';

export interface LazyEditorPlugin {
	id: string;
	matches: (project: ProjectObjectModel) => boolean;
	load: () => Promise<EditorPlugin>;
}

/** Loading is asynchronous; each loaded plugin still uses the ordinary synchronous setup contract. */
export function createLazyPluginLoaderPlugin(plugins: readonly LazyEditorPlugin[]): EditorPlugin {
	return {
		id: 'lazy-loader',
		setup: context => {
			const { store, events, menus } = context;
			const installed = new Map<string, () => void>();
			const pending = new Set<string>();
			let disposed = false;

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
				const project = serializeToProject(store.getState());
				for (const entry of plugins) {
					if (!installed.has(entry.id) && !pending.has(entry.id) && entry.matches(project)) {
						void activate(entry);
					}
				}
			};
			const onProjectChange = () => {
				if (store.getState().projectChange.kind === 'replace') scan();
			};
			const unregisterMenu = menus.registerItem('mainMenu', () => ({
				title: 'Load plugins used by project',
				action: 'loadPluginsUsedByProject',
				close: true,
			}));
			store.subscribe('projectChange', onProjectChange);
			events.on('loadPluginsUsedByProject', scan);
			scan();

			return () => {
				disposed = true;
				store.unsubscribe('projectChange', onProjectChange);
				events.off('loadPluginsUsedByProject', scan);
				unregisterMenu();
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
