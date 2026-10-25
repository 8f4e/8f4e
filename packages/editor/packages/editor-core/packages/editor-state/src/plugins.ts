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
	const context: EditorStatePluginContext = { store, events, menus };

	try {
		for (const plugin of plugins) {
			cleanups.push(plugin.setup(context));
		}
	} catch (error) {
		dispose();
		throw error;
	}
	return dispose;
}
