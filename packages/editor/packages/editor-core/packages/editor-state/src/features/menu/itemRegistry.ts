import type {
	ContextMenuItem,
	EditorMenuId,
	EditorMenuItemContext,
	EditorMenuItemProvider,
	EditorMenuRegistry,
} from '@8f4e/editor-state-types';

export interface MenuItemRegistry extends EditorMenuRegistry {
	getItems: (menu: EditorMenuId, context: EditorMenuItemContext) => ContextMenuItem[];
}

export default function createMenuItemRegistry(): MenuItemRegistry {
	const registrations = new Set<{ menu: EditorMenuId; provider: EditorMenuItemProvider }>();
	return {
		registerItem: (menu, provider) => {
			const registration = { menu, provider };
			registrations.add(registration);
			return () => {
				registrations.delete(registration);
			};
		},
		getItems: (menu, context) => {
			const items: ContextMenuItem[] = [];
			for (const registration of registrations) {
				if (registration.menu !== menu) continue;
				const item = registration.provider(context);
				if (item !== undefined) items.push(item);
			}
			return items;
		},
	};
}
