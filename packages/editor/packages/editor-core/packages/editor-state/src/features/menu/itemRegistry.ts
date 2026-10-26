import type {
	ContextMenuItem,
	EditorMenuId,
	EditorMenuItemContext,
	EditorMenuItemProvider,
	EditorMenuRegistry,
} from '@8f4e/editor-state-types';

export interface MenuItemRegistry extends EditorMenuRegistry {
	getItems: <Menu extends EditorMenuId>(menu: Menu, context: EditorMenuItemContext<Menu>) => ContextMenuItem[];
}

export default function createMenuItemRegistry(): MenuItemRegistry {
	const registrations: { [Menu in EditorMenuId]: Set<{ provider: EditorMenuItemProvider<Menu> }> } = {
		mainMenu: new Set(),
		moduleMenu: new Set(),
	};
	return {
		registerItem: (menu, provider) => {
			const registration = { provider };
			registrations[menu].add(registration);
			return () => {
				registrations[menu].delete(registration);
			};
		},
		getItems: (menu, context) => {
			const items: ContextMenuItem[] = [];
			for (const registration of registrations[menu]) {
				const item = registration.provider(context);
				if (item !== undefined) items.push(item);
			}
			return items;
		},
	};
}
