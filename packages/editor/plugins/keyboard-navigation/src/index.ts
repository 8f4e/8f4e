import type { EditorPlugin } from '@8f4e/editor-core';
import {
	getRawIndexForVisualColumn,
	getTabStopsByLine,
	getVisualColumnForRawIndex,
	moveCaret,
} from '@8f4e/editor-state';
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
					events.dispatch<NavigateCodeBlockEvent>('navigateCodeBlock', { direction });
					return;
				}
				const state = store.getState();
				const block = state.codeBlockRendering.selectedCodeBlock;
				if (!state.featureFlags.codeLineSelection || !block) return;
				// View mode selects lines; horizontal caret movement is editing behavior.
				if (state.editorMode === 'view' && (direction === 'left' || direction === 'right')) return;
				event.preventDefault();
				let row = block.cursor.row;
				let col = block.cursor.col;
				if (direction === 'up' || direction === 'down') {
					const tabStops = getTabStopsByLine(block.code);
					const visualCol = getVisualColumnForRawIndex(block.code[row], col, tabStops[row]);
					row = Math.max(0, Math.min(row + (direction === 'up' ? -1 : 1), block.code.length - 1));
					col = getRawIndexForVisualColumn(block.code[row], visualCol, tabStops[row]);
				} else {
					[row, col] = moveCaret(block.code, row, col, direction);
				}
				store.set('codeBlockRendering.selectedCodeBlock.cursor.row', row);
				store.set('codeBlockRendering.selectedCodeBlock.cursor.col', col);
			};
			inputTarget.addEventListener('keydown', onKeydown);
			return () => inputTarget.removeEventListener('keydown', onKeydown);
		},
	};
}
