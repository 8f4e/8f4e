import type {
	CodeBlockGraphicData,
	ContextMenuItem,
	EventDispatcher,
	MenuStackEntry,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import roundToGrid from '~/features/viewport/roundToGrid';
import findCodeBlockAtViewportCoordinates from '../code-blocks/utils/finders/findCodeBlockAtViewportCoordinates';
import * as menus from './menus';
import type { MenuRegistry } from './registry';

interface MouseEvent {
	x: number;
	y: number;
	buttons?: number;
	stopPropagation?: boolean;
}

function getHighlightedMenuItem(x: number, y: number, width: number, height: number) {
	if (x < 0 || x > width || y < 0) {
		return Infinity;
	}
	return Math.floor(y / height);
}

function getLongestMenuItem(menuItems: ContextMenuItem[], min = 16) {
	return menuItems.reduce((acc, curr) => {
		if (!curr.title?.length) {
			return acc;
		}
		return acc < curr.title.length ? curr.title.length : acc;
	}, min);
}

function decorateMenu(menuItems: ContextMenuItem[]) {
	const longest = getLongestMenuItem(menuItems);
	return menuItems.map(item => {
		if (item.divider) {
			return item;
		}

		const title = item.close === false ? item.title + ' >' : item.title;

		const pad = '.'.repeat(longest + 2 - (title?.length || 0));
		return {
			...item,
			title: item.isSectionTitle ? title + ' ' + pad : pad + ' ' + title,
		};
	});
}

function getMenuViewportPosition(state: State): { x: number; y: number } {
	const { x, y } = state.contextMenu;
	return {
		x: x - state.viewport.x,
		y: y - state.viewport.y,
	};
}

function keepMenuWithinViewport(state: State): void {
	const { contextMenu, viewport } = state;
	const { x, y } = getMenuViewportPosition(state);
	const maxX = Math.max(viewport.width - contextMenu.itemWidth, 0);
	const maxY = Math.max(viewport.height - contextMenu.items.length * viewport.hGrid, 0);

	contextMenu.x = viewport.x + Math.min(Math.max(x, 0), maxX);
	contextMenu.y = viewport.y + Math.min(Math.max(y, 0), maxY);
}

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
		state.contextMenu.items = decorateMenu([
			...(menuStack.length > 1 ? [{ title: '< Back', action: 'menuBack' }] : []),
			...items,
		]);
		state.contextMenu.itemWidth = getLongestMenuItem(state.contextMenu.items) * state.viewport.vGrid;
		keepMenuWithinViewport(state);
	};
	const onMouseMove = (event: MouseEvent) => {
		if (!state.contextMenu.open) {
			return;
		}
		const { itemWidth } = state.contextMenu;
		const { x, y } = getMenuViewportPosition(state);
		state.contextMenu.highlightedItem = getHighlightedMenuItem(
			event.x - x,
			event.y - y,
			itemWidth,
			state.viewport.hGrid
		);
		event.stopPropagation = true;
	};

	const close = () => {
		state.contextMenu.open = false;
	};

	const onMouseDown = (event: MouseEvent) => {
		if (!state.contextMenu.open) {
			return;
		}
		event.stopPropagation = true;
		const { highlightedItem, items } = state.contextMenu;
		const item = items[highlightedItem];

		if (item) {
			if (item.close) {
				close();
			}

			if (item.selector) {
				store.set(item.selector, item.value);
			} else if (item.action) {
				events.dispatch(item.action, {
					...item.payload,
					x: event.x,
					y: event.y,
				});
			}
		} else {
			close();
		}
	};

	const onContextMenu = async (event: MouseEvent) => {
		if (!state.featureFlags.contextMenu) {
			return;
		}

		const { x, y } = event;

		state.contextMenu.highlightedItem = 0;

		const [roundedX, roundedY] = roundToGrid(x + state.viewport.x, y + state.viewport.y, state.viewport);
		state.contextMenu.x = roundedX;
		state.contextMenu.y = roundedY;

		state.contextMenu.open = true;

		const codeBlock = findCodeBlockAtViewportCoordinates(state, x, y);

		state.contextMenu.menuStack = [codeBlock ? { menu: 'moduleMenu', payload: { codeBlock } } : { menu: 'mainMenu' }];
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
	events.on('contextmenu', onContextMenu);
	events.on('menuBack', onMenuBack);
	events.on('mousedown', onMouseDown);
	events.on('mousemove', onMouseMove, { capture: true });

	return () => {
		for (const unregister of unregisterMenus) unregister();
		events.off('contextmenu', onContextMenu);
		events.off('openSubMenu', onOpenSubMenu);
		events.off('menuBack', onMenuBack);
		events.off('mousedown', onMouseDown);
		events.off('mousemove', onMouseMove);
	};
}
