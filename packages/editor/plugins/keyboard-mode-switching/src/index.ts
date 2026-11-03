import type { EditorPlugin } from '@8f4e/editor-core';
import drawModeHint from './drawModeHint';

export function createKeyboardModeSwitchingPlugin({ inputTarget }: { inputTarget: HTMLElement }): EditorPlugin {
	return {
		id: 'keyboard-mode-switching',
		setup: ({ store, events, drawers }) => {
			const removeHint = drawers.registerCanvasOverlay(drawModeHint);
			const onKeydown = (event: KeyboardEvent) => {
				const state = store.getState();
				if (event.defaultPrevented) return;
				if (event.key === 'Escape' && state.editorMode === 'edit') {
					event.preventDefault();
					events.dispatch('exitToViewMode');
				} else if (
					event.key === 'e' &&
					state.editorMode === 'view' &&
					!event.altKey &&
					!event.ctrlKey &&
					!event.metaKey
				) {
					event.preventDefault();
					events.dispatch('enterEditMode');
				}
			};
			inputTarget.addEventListener('keydown', onKeydown);
			return () => {
				inputTarget.removeEventListener('keydown', onKeydown);
				removeHint();
			};
		},
	};
}
