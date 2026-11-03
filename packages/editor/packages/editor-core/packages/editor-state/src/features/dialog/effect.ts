import type {
	ActivateDialogButtonEvent,
	DialogContent,
	EventDispatcher,
	InternalPointerEvent,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

type RemoveDialogEvent = string | { id: string };

export default function dialog(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function syncVisibleDialog() {
		const visibleDialog = state.dialogStack.at(-1);
		store.set('dialog', visibleDialog ?? { id: '', title: '', text: '', buttons: [] });
	}

	function addDialog(dialogContent: DialogContent) {
		store.set('dialogStack', [...state.dialogStack.filter(dialog => dialog.id !== dialogContent.id), dialogContent]);
	}

	function removeDialog(event: RemoveDialogEvent) {
		const id = typeof event === 'string' ? event : event.id;
		store.set(
			'dialogStack',
			state.dialogStack.filter(dialog => dialog.id !== id)
		);
	}

	function activateButton({ id, buttonIndex }: ActivateDialogButtonEvent) {
		const visibleDialog = state.dialogStack.at(-1);
		if (!visibleDialog || visibleDialog.id !== id) return;
		const button = visibleDialog.buttons[buttonIndex];
		if (button.close !== false) removeDialog(id);
		if (button.action) events.dispatch(button.action, button.payload);
	}

	function onPointerDown(event: InternalPointerEvent): void {
		if (state.dialogStack.length === 0) return;
		// Forward only completed presses: capture-only touch probes must not activate buttons.
		events.dispatch('dialogPointerDown', event);
		event.stopPropagation = true;
	}

	function blockPointerEvent(event: InternalPointerEvent): void {
		if (state.dialogStack.length > 0) event.stopPropagation = true;
	}

	function clearDialogs(): void {
		store.set('dialogStack', []);
	}

	store.subscribe('dialogStack', syncVisibleDialog);
	events.on('addDialog', addDialog);
	events.on('removeDialog', removeDialog);
	events.on('clearDialogs', clearDialogs);
	events.on('activateDialogButton', activateButton);
	events.on('pointermove', blockPointerEvent, { capture: true });
	events.on('pointerdown', onPointerDown);
	events.on('pointerup', blockPointerEvent);
	events.on('contextmenu', blockPointerEvent);
	syncVisibleDialog();

	return () => {
		store.unsubscribe('dialogStack', syncVisibleDialog);
		events.off('addDialog', addDialog);
		events.off('removeDialog', removeDialog);
		events.off('clearDialogs', clearDialogs);
		events.off('activateDialogButton', activateButton);
		events.off('pointermove', blockPointerEvent);
		events.off('pointerdown', onPointerDown);
		events.off('pointerup', blockPointerEvent);
		events.off('contextmenu', blockPointerEvent);
	};
}
