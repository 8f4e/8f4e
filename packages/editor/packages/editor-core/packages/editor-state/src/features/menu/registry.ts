import type {
	ContextMenuItem,
	EditorMenuItemContext,
	EditorMenuItemProvider,
	EditorMenuItemSlot,
	EditorMenuRegistry,
	MenuGenerator,
	MenuStackEntry,
	State,
} from '@8f4e/editor-state-types';

export interface MenuRegistry extends EditorMenuRegistry {
	generateMenu: (request: MenuStackEntry, state: State) => ContextMenuItem[] | Promise<ContextMenuItem[]>;
	getItems: <Menu extends EditorMenuItemSlot>(menu: Menu, context: EditorMenuItemContext<Menu>) => ContextMenuItem[];
}

export default function createMenuRegistry(): MenuRegistry {
	const registrations: { [Menu in EditorMenuItemSlot]: Set<{ provider: EditorMenuItemProvider<Menu> }> } = {
		mainMenu: new Set(),
		moduleMenu: new Set(),
	};
	const generators = new Map<string, MenuGenerator>();
	return {
		registerMenu: (menu, generator) => {
			generators.set(menu, generator as MenuGenerator);
			return () => {
				generators.delete(menu);
			};
		},
		generateMenu: (request, state) => generators.get(request.menu)!(state, request.payload),
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
