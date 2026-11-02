import type {
	Direction,
	InsertTextEvent,
	MoveCaretEvent,
	NavigateCodeBlockEvent,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import type { EventDispatcher } from '.';

/**
 * Converts keyboard arrow key names to abstract Direction values used for navigation.
 * @param key - The keyboard key name (e.g., 'ArrowLeft', 'ArrowRight')
 * @returns The corresponding Direction ('left', 'right', 'up', 'down') or null if not an arrow key
 */
function getDirectionFromArrowKey(key: string): Direction | null {
	switch (key) {
		case 'ArrowLeft':
			return 'left';
		case 'ArrowRight':
			return 'right';
		case 'ArrowUp':
			return 'up';
		case 'ArrowDown':
			return 'down';
		default:
			return null;
	}
}

/**
 * Sets up keyboard event handling for the editor and dispatches high-level
 * editor actions via the provided EventDispatcher.
 *
 * This listener interprets key presses and may dispatch the following events:
 * - `undo` – when the modifier key + Z (without Shift) is pressed.
 * - `redo` – when the modifier key + Shift+Z or modifier key + Y is pressed.
 * - `navigateCodeBlock` – when the modifier key + an arrow key is pressed; payload includes a direction.
 * - `moveCaret` – when an arrow key is pressed without modifiers; payload includes a direction.
 * - `deleteBackward` – when Backspace is pressed.
 * - `insertNewLine` – when Enter is pressed.
 * - `insertText` – when a single printable character key is pressed without modifier keys; payload includes text.
 *
 * @param element - Focusable editor element that owns the keyboard input.
 * @param events - Dispatcher used to emit editor actions in response to keyboard input.
 * @param store - State manager for reading the editor mode and feature flags.
 * @returns A cleanup function that removes the keyboard event listeners.
 */
export default function keyboardEvents(
	element: HTMLElement,
	events: EventDispatcher,
	store: StateManager<State>
): () => void {
	function onKeydown(event: KeyboardEvent) {
		const { key, metaKey, ctrlKey } = event;
		const state = store.getState();

		if (key === 'Escape' && state.editorMode === 'edit' && state.featureFlags.modeToggling) {
			event.preventDefault();
			events.dispatch('exitToViewMode');
			return;
		}

		// Modal switching: e enters edit mode from view mode.
		if (state.featureFlags.modeToggling) {
			if (state.editorMode === 'view' && key === 'e' && !event.altKey && !event.ctrlKey && !event.metaKey) {
				event.preventDefault();
				events.dispatch('enterEditMode');
				return;
			}
		}

		// Platform-specific modifier key (metaKey on macOS, ctrlKey on Windows/Linux)
		const modifierKey = metaKey || ctrlKey;

		// Handle modifier + key shortcuts
		if (modifierKey) {
			const lowerKey = key.toLowerCase();

			// Undo
			if (lowerKey === 'z' && !event.shiftKey) {
				event.preventDefault();
				events.dispatch('undo');
				return;
			}

			// Redo (Cmd+Shift+Z on macOS, Ctrl+Y on Windows/Linux, or Cmd+Y on macOS)
			if ((lowerKey === 'z' && event.shiftKey) || lowerKey === 'y') {
				event.preventDefault();
				events.dispatch('redo');
				return;
			}

			// Navigation with modifier + arrow keys
			if (key.startsWith('Arrow')) {
				const direction = getDirectionFromArrowKey(key);
				if (direction) {
					event.preventDefault();
					events.dispatch<NavigateCodeBlockEvent>('navigateCodeBlock', { direction });
				}
				return;
			}

			// Other modifier key combinations are not handled, don't prevent default
			return;
		}

		// Handle editing keys when no modifier is pressed

		// Arrow keys for caret movement
		if (key.startsWith('Arrow')) {
			const direction = getDirectionFromArrowKey(key);
			if (direction) {
				event.preventDefault();
				events.dispatch<MoveCaretEvent>('moveCaret', { direction });
			}
			return;
		}

		// Backspace
		if (key === 'Backspace') {
			event.preventDefault();
			events.dispatch('deleteBackward');
			return;
		}

		// Enter
		if (key === 'Enter') {
			event.preventDefault();
			events.dispatch('insertNewLine');
			return;
		}

		// Tab
		if (key === 'Tab') {
			if (state.editorMode !== 'edit') {
				return;
			}
			event.preventDefault();
			events.dispatch<InsertTextEvent>('insertText', { text: '\t' });
			return;
		}

		// Single character text input
		// Only handle printable characters, excluding control keys and modifiers
		if (
			key.length === 1 &&
			!event.altKey &&
			!event.ctrlKey &&
			!event.metaKey &&
			key !== 'Dead' // Dead keys for compose sequences
		) {
			event.preventDefault();
			events.dispatch<InsertTextEvent>('insertText', { text: key });
			return;
		}
	}

	element.addEventListener('keydown', onKeydown);

	return () => {
		element.removeEventListener('keydown', onKeydown);
	};
}
