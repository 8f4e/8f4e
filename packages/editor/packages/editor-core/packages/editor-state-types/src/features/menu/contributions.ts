import type { CodeBlockGraphicData, ContextMenuItem, MenuGenerator, State } from '../../index';

interface EditorMenuItemContexts {
	mainMenu: { state: State };
	moduleMenu: {
		state: State;
		/** The block the menu was opened for, independently of the current selection. */
		codeBlock: CodeBlockGraphicData;
	};
}

export type EditorMenuItemSlot = keyof EditorMenuItemContexts;
export type EditorMenuItemContext<Menu extends EditorMenuItemSlot> = EditorMenuItemContexts[Menu];
export type EditorMenuItemProvider<Menu extends EditorMenuItemSlot> = (
	context: EditorMenuItemContext<Menu>
) => ContextMenuItem | undefined;

export interface EditorMenuRegistry {
	/** Register a complete menu; open it with openSubMenu and a matching menu ID and payload. */
	registerMenu: <Payload = unknown>(menu: string, generator: MenuGenerator<Payload>) => () => void;
	/** Derive an item each time the menu opens; return undefined to omit it. */
	registerItem: <Menu extends EditorMenuItemSlot>(menu: Menu, provider: EditorMenuItemProvider<Menu>) => () => void;
}
