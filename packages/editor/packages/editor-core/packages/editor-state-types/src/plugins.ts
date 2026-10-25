import type { StateManager } from '@8f4e/state-manager';
import type { EventDispatcher, State } from './index';

export interface EditorStatePluginContext {
	store: Omit<StateManager<State>, 'dispose'>;
	events: EventDispatcher;
}

/** A trusted, synchronous state extension installed once per editor instance. */
export interface EditorStatePlugin {
	id: string;
	/** Actions implemented by this plugin, used to determine menu availability. */
	actions?: readonly string[];
	/** Subscriptions are scoped to the editor; return cleanup for any other resources. */
	setup: (context: EditorStatePluginContext) => void | (() => void);
}
