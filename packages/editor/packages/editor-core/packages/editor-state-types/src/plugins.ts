import type { StateManager } from '@8f4e/state-manager';
import type { CodeBlockGraphicData, ContextMenuItem, EventDispatcher, State } from './index';

/** The code-block context menu is the first supported contribution point. */
export type EditorMenuId = 'moduleMenu';

export interface EditorMenuItemContext {
	state: State;
	/** The block the menu was opened for, independently of the current selection. */
	codeBlock?: CodeBlockGraphicData;
}

export type EditorMenuItemProvider = (context: EditorMenuItemContext) => ContextMenuItem | undefined;

export interface EditorMenuRegistry {
	/** Derive an item each time the menu opens; return undefined to omit it. */
	registerItem: (menu: EditorMenuId, provider: EditorMenuItemProvider) => () => void;
}

export interface EditorStatePluginContext {
	store: Omit<StateManager<State>, 'dispose'>;
	events: EventDispatcher;
	menus: EditorMenuRegistry;
}

/** A trusted, synchronous state extension installed once per editor instance. */
export interface EditorStatePlugin {
	id: string;
	/** Subscriptions and menu registrations are scoped to the editor; return cleanup for other resources. */
	setup: (context: EditorStatePluginContext) => void | (() => void);
}
