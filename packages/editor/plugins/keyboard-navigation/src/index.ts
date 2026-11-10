import type { EditorPlugin } from '@8f4e/editor-core';
import { clampSourcePosition } from '@8f4e/editor-state';
import type { Direction, NavigateCodeBlockEvent } from '@8f4e/editor-state-types';

const directions: Record<string, Direction> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
};

export function createKeyboardNavigationPlugin({ inputTarget }: { inputTarget: HTMLElement }): EditorPlugin {
	return {
		id: 'keyboard-navigation',
		setup: ({ store, events }) => {
			const onKeydown = (event: KeyboardEvent) => {
				const direction = directions[event.key];
				if (event.defaultPrevented || !direction) return;
				if (event.metaKey || event.ctrlKey) {
					event.preventDefault();
					events.dispatch('navigateCodeBlock', { direction } satisfies NavigateCodeBlockEvent);
					return;
				}
				const state = store.getState();
				const block = state.codeBlockRendering.selectedCodeBlock;
				if (state.editorMode !== 'view' || !state.featureFlags.codeLineSelection || !block) return;
				if (direction === 'left' || direction === 'right') return;
				event.preventDefault();
				const [row, col] = clampSourcePosition(
					block.code,
					block.cursor.row + (direction === 'up' ? -1 : 1),
					block.cursor.col
				);
				store.set('codeBlockRendering.selectedCodeBlock.cursor.row', row);
				store.set('codeBlockRendering.selectedCodeBlock.cursor.col', col);
			};
			inputTarget.addEventListener('keydown', onKeydown);
			return () => inputTarget.removeEventListener('keydown', onKeydown);
		},
	};
}
