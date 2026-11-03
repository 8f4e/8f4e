import type { EditorPlugin } from '@8f4e/editor-core';
import type { ActivateDialogButtonEvent, InternalPointerEvent } from '@8f4e/editor-state-types';
import drawDialog from './drawDialog';
import layoutDialog from './layoutDialog';
import type { DialogLayout } from './types';

export const dialogsPlugin: EditorPlugin = {
	id: 'dialogs',
	setup: ({ store, events, drawers }) => {
		const state = store.getState();
		let layout: DialogLayout | undefined;
		const updateLayout = () => {
			const dialog = state.dialogStack.at(-1);
			layout = dialog ? layoutDialog(dialog, state.viewport) : undefined;
		};
		const findButton = ({ x, y }: InternalPointerEvent) => {
			const current = layout;
			return (
				current?.buttons.findIndex(
					button =>
						x >= current.x + button.x &&
						x < current.x + button.x + button.width &&
						y >= current.y + button.y &&
						y < current.y + button.y + button.height
				) ?? -1
			);
		};
		const onPointerDown = (event: InternalPointerEvent) => {
			const buttonIndex = findButton(event);
			if (!layout || buttonIndex === -1) return;
			events.dispatch<ActivateDialogButtonEvent>('activateDialogButton', { id: layout.id, buttonIndex });
		};
		const unregisterDrawer = drawers.registerModalOverlay(({ draw, state }) => {
			if (layout) drawDialog(draw, state, layout);
		});
		store.subscribe('dialogStack', updateLayout);
		events.on('resize', updateLayout);
		events.on('gridSizeChanged', updateLayout);
		events.on('dialogPointerDown', onPointerDown);
		updateLayout();
		return () => {
			unregisterDrawer();
			store.unsubscribe('dialogStack', updateLayout);
			events.off('resize', updateLayout);
			events.off('gridSizeChanged', updateLayout);
			events.off('dialogPointerDown', onPointerDown);
			layout = undefined;
		};
	},
};
