import type {
	EditorMenuRegistry,
	EditorStatePlugin,
	EditorStatePluginContext,
	EventDispatcher,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

export function installEditorStatePlugins(
	plugins: readonly EditorStatePlugin[],
	store: StateManager<State>,
	events: EventDispatcher,
	menus: EditorMenuRegistry
): () => void {
	const cleanups: Array<() => void> = [];
	const dispose = () => {
		while (cleanups.length) {
			cleanups.pop()!();
		}
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
			if (cleanup !== undefined) cleanups.push(cleanup);
		}
	} catch (error) {
		dispose();
		throw error;
	}
	return dispose;
}
