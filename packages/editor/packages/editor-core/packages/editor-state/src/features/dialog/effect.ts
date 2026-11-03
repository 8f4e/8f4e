import type { DialogContent, EventDispatcher, InternalPointerEvent, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import roundToGrid from '~/features/viewport/roundToGrid';
import wrapText from '../code-blocks/utils/wrapText';
import layoutButtons from './layoutButtons';

const DIALOG_MIN_WIDTH_GRID_CELLS = 64;
const DIALOG_MAX_WIDTH_GRID_CELLS = 96;
const DIALOG_VERTICAL_GRID_CELLS_WITHOUT_TEXT = 5;

type RemoveDialogEvent = string | { id: string };

export default function dialog(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function syncVisibleDialog() {
		const visibleDialog = state.dialogStack[state.dialogStack.length - 1];

		if (!visibleDialog) {
			state.dialog.id = '';
			state.dialog.text = '';
			state.dialog.wrappedText = [''];
			state.dialog.title = '';
			state.dialog.buttons = [];
			state.dialog.highlightedButton = Infinity;
			state.dialog.width = 0;
			state.dialog.height = 0;
			state.dialog.x = 0;
			state.dialog.y = 0;
			return;
		}

		const dialogWidth = Math.min(
			Math.max(state.viewport.width * 0.5, DIALOG_MIN_WIDTH_GRID_CELLS * state.viewport.vGrid),
			DIALOG_MAX_WIDTH_GRID_CELLS * state.viewport.vGrid
		);
		const availableWidth = state.viewport.width - 2 * state.viewport.vGrid;
		const roundedDialogWidth = Math.max(
			state.viewport.vGrid,
			Math.floor(Math.min(dialogWidth, availableWidth) / state.viewport.vGrid) * state.viewport.vGrid
		);
		const textWidth = Math.max(1, Math.floor(roundedDialogWidth / state.viewport.vGrid) - 2);
		const wrappedText = wrapText(visibleDialog.text, textWidth);
		const buttonLayout = layoutButtons(
			visibleDialog.buttons,
			roundedDialogWidth,
			wrappedText.length,
			state.viewport.vGrid,
			state.viewport.hGrid
		);
		const roundedDialogHeight =
			(wrappedText.length + buttonLayout.heightInGridRows + DIALOG_VERTICAL_GRID_CELLS_WITHOUT_TEXT) *
			state.viewport.hGrid;

		state.dialog.id = visibleDialog.id;
		state.dialog.text = visibleDialog.text;
		state.dialog.title = visibleDialog.title.slice(0, textWidth);
		state.dialog.buttons = buttonLayout.buttons;
		state.dialog.highlightedButton = Infinity;
		state.dialog.width = roundedDialogWidth;
		state.dialog.height = roundedDialogHeight;

		const [roundedDialogX, roundedDialogY] = roundToGrid(
			(state.viewport.width - state.dialog.width) / 2,
			(state.viewport.height - state.dialog.height) / 2,
			state.viewport
		);

		state.dialog.x = roundedDialogX;
		state.dialog.y = roundedDialogY;

		state.dialog.wrappedText = wrappedText;
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

	function findButtonAtCoordinates(x: number, y: number): number {
		const dialogX = x - state.dialog.x;
		const dialogY = y - state.dialog.y;

		return state.dialog.buttons.findIndex(
			button =>
				dialogX >= button.x &&
				dialogX < button.x + button.width &&
				dialogY >= button.y &&
				dialogY < button.y + button.height
		);
	}

	function onPointerMove(event: InternalPointerEvent): void {
		if (state.dialogStack.length === 0) {
			return;
		}

		const buttonIndex = findButtonAtCoordinates(event.x, event.y);
		state.dialog.highlightedButton = buttonIndex === -1 ? Infinity : buttonIndex;
		event.stopPropagation = true;
	}

	function onPointerDown(event: InternalPointerEvent): void {
		if (state.dialogStack.length === 0) {
			return;
		}

		const buttonIndex = findButtonAtCoordinates(event.x, event.y);
		const button = state.dialog.buttons[buttonIndex];
		event.stopPropagation = true;

		if (!button) {
			return;
		}

		const dialogId = state.dialog.id;
		if (button.close !== false) {
			removeDialog({ id: dialogId });
		}

		if (button.action) {
			events.dispatch(button.action, button.payload);
		}
	}

	function blockPointerEvent(event: InternalPointerEvent): void {
		if (state.dialogStack.length > 0) {
			event.stopPropagation = true;
		}
	}

	function clearDialogs(): void {
		store.set('dialogStack', []);
	}

	store.subscribe('dialogStack', syncVisibleDialog);
	events.on('resize', syncVisibleDialog);
	events.on('addDialog', addDialog);
	events.on('removeDialog', removeDialog);
	events.on('clearDialogs', clearDialogs);
	events.on('pointermove', onPointerMove, { capture: true });
	events.on('pointerdown', onPointerDown, { capture: true });
	events.on('pointerup', blockPointerEvent);
	events.on('contextmenu', blockPointerEvent);

	syncVisibleDialog();

	return () => {
		store.unsubscribe('dialogStack', syncVisibleDialog);
		events.off('resize', syncVisibleDialog);
		events.off('addDialog', addDialog);
		events.off('removeDialog', removeDialog);
		events.off('clearDialogs', clearDialogs);
		events.off('pointermove', onPointerMove);
		events.off('pointerdown', onPointerDown);
		events.off('pointerup', blockPointerEvent);
		events.off('contextmenu', blockPointerEvent);
	};
}
