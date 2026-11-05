import type { EditorPlugin } from '@8f4e/editor-core';
import type { ActivateContextMenuItemEvent, InternalPointerEvent } from '@8f4e/editor-state-types';
import drawMenu from './drawMenu';
import layoutMenu from './layoutMenu';

export const contextMenuPlugin: EditorPlugin = {
	id: 'context-menu',
	setup: ({ store, events, drawers }) => {
		const state = store.getState();
		let layout: ReturnType<typeof layoutMenu> | undefined;
		let highlighted = 0;
		const updateLayout = () => {
			layout =
				state.contextMenu.open && state.contextMenu.items.length
					? layoutMenu(state.contextMenu, state.viewport)
					: undefined;
		};
		const updateMenu = () => {
			highlighted = 0;
			updateLayout();
		};
		const findItem = ({ x, y }: InternalPointerEvent) => {
			if (!layout || x < layout.x || x >= layout.x + layout.width || y < layout.y || y >= layout.y + layout.height)
				return -1;
			return Math.floor((y - layout.y) / layout.rowHeight);
		};
		const onPointerMove = (event: InternalPointerEvent) => {
			highlighted = findItem(event);
		};
		const onPointerDown = (event: InternalPointerEvent) => {
			const index = findItem(event);
			if (index === -1) events.dispatch('closeContextMenu');
			else events.dispatch<ActivateContextMenuItemEvent>('activateContextMenuItem', { index, x: event.x, y: event.y });
		};
		const unregisterDrawer = drawers.registerContextMenuOverlay(({ draw }) => {
			if (layout) drawMenu(draw, state.contextMenu.items, layout, highlighted);
		});
		store.subscribe('contextMenu', updateMenu);
		events.on('resize', updateLayout);
		events.on('gridSizeChanged', updateLayout);
		events.on('viewportChanged', updateLayout);
		events.on('contextMenuPointerMove', onPointerMove);
		events.on('contextMenuPointerDown', onPointerDown);
		updateLayout();
		return () => {
			unregisterDrawer();
			store.unsubscribe('contextMenu', updateMenu);
			events.off('resize', updateLayout);
			events.off('gridSizeChanged', updateLayout);
			events.off('viewportChanged', updateLayout);
			events.off('contextMenuPointerMove', onPointerMove);
			events.off('contextMenuPointerDown', onPointerDown);
		};
	},
};
