import type {
	EditorDirectiveRegistry,
	EditorLayoutRegistry,
	EditorLoadingRegistry,
	EditorMenuRegistry,
	EventDispatcher,
	ProjectTransactions,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import type { EditorRenderRegistry } from '@8f4e/web-ui';
import { disposeAll } from './disposeAll';

export interface EditorPluginContext {
	store: Omit<StateManager<State>, 'dispose'> & { projectTransactions: ProjectTransactions };
	events: EventDispatcher;
	menus: EditorMenuRegistry;
	directives: EditorDirectiveRegistry;
	layout: EditorLayoutRegistry;
	loading: EditorLoadingRegistry;
	renderRegistry: EditorRenderRegistry;
}

/** A trusted, synchronous extension installed once per editor instance. */
export interface EditorPlugin {
	id: string;
	/** Return a disposer for every resource owned by this plugin. */
	setup: (context: EditorPluginContext) => () => void;
}

export function installEditorPlugins(plugins: readonly EditorPlugin[], context: EditorPluginContext): () => void {
	const cleanups: Array<() => void> = [];
	const dispose = () => disposeAll(cleanups);
	try {
		for (const plugin of plugins) cleanups.push(plugin.setup(context));
	} catch (error) {
		dispose();
		throw error;
	}
	return dispose;
}
