import type {
	EditorMenuRegistry,
	EditorStatePlugin,
	EditorStatePluginContext,
	EventDispatcher,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import createMenuItemRegistry from './features/menu/itemRegistry';

export function validateEditorStatePlugins(plugins: readonly EditorStatePlugin[]): void {
	const ids = new Set<string>();
	for (const plugin of plugins) {
		if (!plugin.id.trim() || ids.has(plugin.id)) {
			throw new Error(`Invalid or duplicate editor state plugin ID: "${plugin.id}"`);
		}
		ids.add(plugin.id);
	}
}

export function installEditorStatePlugins(
	plugins: readonly EditorStatePlugin[],
	store: StateManager<State>,
	events: EventDispatcher,
	menus: EditorMenuRegistry = createMenuItemRegistry()
): () => void {
	const cleanups: Array<() => void> = [];
	let disposed = false;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		for (let index = cleanups.length - 1; index >= 0; index--) {
			try {
				cleanups[index]();
			} catch (error) {
				console.error('Failed to dispose editor state plugin resource:', error);
			}
		}
		cleanups.length = 0;
	};
	const context: EditorStatePluginContext = {
		store: {
			getState: store.getState,
			set: store.set,
			subscribe: (selector, callback) => {
				const subscription = store.subscribe(selector, callback);
				cleanups.push(() => store.unsubscribe(selector, callback));
				return subscription;
			},
			subscribeToValue: (selector, matcher, callback) => {
				const subscription = store.subscribeToValue(selector, matcher, callback);
				cleanups.push(() => store.unsubscribe(selector, callback));
				return subscription;
			},
			unsubscribe: store.unsubscribe,
		},
		events: {
			on: (name, callback) => {
				events.on(name, callback);
				cleanups.push(() => events.off(name, callback));
			},
			off: events.off,
			dispatch: events.dispatch,
		},
		menus: {
			registerItem: (menu, provider) => {
				const unregister = menus.registerItem(menu, provider);
				cleanups.push(unregister);
				return unregister;
			},
		},
	};

	try {
		for (const plugin of plugins) {
			const cleanup = plugin.setup(context);
			if (cleanup) cleanups.push(cleanup);
		}
	} catch (error) {
		dispose();
		throw error;
	}
	return dispose;
}
