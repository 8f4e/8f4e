import type { CodeBlockGraphicData, ContextMenuItem, State } from '../../index';

interface EditorMenuContexts {
	mainMenu: { state: State };
	moduleMenu: {
		state: State;
		/** The block the menu was opened for, independently of the current selection. */
		codeBlock: CodeBlockGraphicData;
	};
}

export type EditorMenuId = keyof EditorMenuContexts;
export type EditorMenuItemContext<Menu extends EditorMenuId> = EditorMenuContexts[Menu];
export type EditorMenuItemProvider<Menu extends EditorMenuId> = (
	context: EditorMenuItemContext<Menu>
) => ContextMenuItem | undefined;

export interface EditorMenuRegistry {
	/** Derive an item each time the menu opens; return undefined to omit it. */
	registerItem: <Menu extends EditorMenuId>(menu: Menu, provider: EditorMenuItemProvider<Menu>) => () => void;
}
