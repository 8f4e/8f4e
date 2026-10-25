import type { CodeBlockGraphicData, ContextMenuItem, State } from '../../index';

/** The code-block context menu is the first supported contribution point. */
export type EditorMenuId = 'moduleMenu';

export interface EditorMenuItemContext {
	state: State;
	/** The block the menu was opened for, independently of the current selection. */
	codeBlock: CodeBlockGraphicData;
}

export type EditorMenuItemProvider = (context: EditorMenuItemContext) => ContextMenuItem | undefined;

export interface EditorMenuRegistry {
	/** Derive an item each time the menu opens; return undefined to omit it. */
	registerItem: (menu: EditorMenuId, provider: EditorMenuItemProvider) => () => void;
}
