import type {
	ActivateContextMenuItemEvent,
	CodeBlockGraphicData,
	EventDispatcher,
	InternalPointerEvent,
	MenuStackEntry,
	State,
} from '@8f4e/editor-state-types';
import { INPUT_LAYERS } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import findCodeBlockAtViewportCoordinates from '../code-blocks/utils/finders/findCodeBlockAtViewportCoordinates';
import * as menus from './menus';
import type { MenuRegistry } from './registry';

export default function contextMenu(
	store: StateManager<State>,
	events: EventDispatcher,
	registry: MenuRegistry
): () => void {
	const state = store.getState();
	const unregisterMenus = [
		registry.registerMenu('mainMenu', state => {
			const contributions = registry.getItems('mainMenu', { state });
			return [...menus.mainMenu(state), ...(contributions.length ? [{ divider: true }, ...contributions] : [])];
		}),
		registry.registerMenu('moduleMenu', (state, { codeBlock }: { codeBlock: CodeBlockGraphicData }) =>
			menus.moduleMenu(state, codeBlock, registry.getItems('moduleMenu', { state, codeBlock }))
		),
	];
	const updateMenu = async () => {
		const { menuStack } = state.contextMenu;
		const items = await registry.generateMenu(menuStack.at(-1)!, state);
		store.set('contextMenu.items', [
			...(menuStack.length > 1 ? [{ title: 'Back', action: 'menuBack' }] : []),
			...items,
		]);
	};
	const close = () => store.set('contextMenu.open', false);
	const activateItem = ({ index, x, y }: ActivateContextMenuItemEvent) => {
		if (!state.contextMenu.open) return;
		const item = state.contextMenu.items[index];
		if (item.disabled || item.divider) return;
		if (item.close) close();
		if (item.selector) store.set(item.selector, item.value);
		else if (item.action) events.dispatch(item.action, { ...item.payload, x, y });
	};
	const onPointerMove = (event: InternalPointerEvent) => {
		if (!state.contextMenu.open) return;
		events.dispatch('contextMenuPointerMove', event);
		event.stopPropagation = true;
	};
	const onPointerDown = (event: InternalPointerEvent) => {
		if (!state.contextMenu.open) return;
		events.dispatch('contextMenuPointerDown', event);
		event.stopPropagation = true;
	};

	const onContextMenu = async (event: InternalPointerEvent) => {
		if (!state.featureFlags.contextMenu) {
			return;
		}

		const { x, y } = event;
		const codeBlock = findCodeBlockAtViewportCoordinates(state, x, y);
		store.set('contextMenu', {
			open: true,
			x: x + state.viewport.x,
			y: y + state.viewport.y,
			items: [],
			menuStack: [codeBlock ? { menu: 'moduleMenu', payload: { codeBlock } } : { menu: 'mainMenu' }],
		});
		await updateMenu();
	};

	const onOpenSubMenu = async (request: MenuStackEntry) => {
		state.contextMenu.menuStack.push(request);
		await updateMenu();
	};

	const onMenuBack = async () => {
		state.contextMenu.menuStack.pop();
		await updateMenu();
	};

	events.on('openSubMenu', onOpenSubMenu);
	events.on('contextmenu', onContextMenu, { layer: INPUT_LAYERS.contextMenu });
	events.on('menuBack', onMenuBack);
	events.on('activateContextMenuItem', activateItem);
	events.on('closeContextMenu', close);
	events.on('pointerdown', onPointerDown, { layer: INPUT_LAYERS.contextMenu });
	events.on('pointermove', onPointerMove, { capture: true, layer: INPUT_LAYERS.contextMenu });

	return () => {
		for (const unregister of unregisterMenus) unregister();
		events.off('contextmenu', onContextMenu);
		events.off('openSubMenu', onOpenSubMenu);
		events.off('menuBack', onMenuBack);
		events.off('activateContextMenuItem', activateItem);
		events.off('closeContextMenu', close);
		events.off('pointerdown', onPointerDown);
		events.off('pointermove', onPointerMove);
	};
}
