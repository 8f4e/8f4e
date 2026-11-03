import type { EventDispatcher, InsertTextEvent, MoveCaretEvent, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../project-changes';
import backSpace from './backSpace';
import enter from './enter';
import { moveCaret } from './moveCaret';
import { getRawIndexForVisualColumn, getTabStopsByLine, getVisualColumnForRawIndex } from './tabLayout';
import type from './type';

export default function codeEditing(store: StateManager<State>, events: EventDispatcher) {
	const state = store.getState();

	const onMoveCaret = (event: MoveCaretEvent) => {
		if (!state.featureFlags.codeLineSelection) {
			return;
		}

		if (!state.codeBlockRendering.selectedCodeBlock) {
			return;
		}

		const codeBlock = state.codeBlockRendering.selectedCodeBlock;
		const tabStopsByLine = getTabStopsByLine(codeBlock.code);

		let newPosition: [number, number];
		if (event.direction === 'up' || event.direction === 'down') {
			const nextRow =
				event.direction === 'up'
					? Math.max(codeBlock.cursor.row - 1, 0)
					: Math.min(codeBlock.cursor.row + 1, codeBlock.code.length - 1);
			const visualCol = getVisualColumnForRawIndex(
				codeBlock.code[codeBlock.cursor.row] || '',
				codeBlock.cursor.col,
				tabStopsByLine[codeBlock.cursor.row] || []
			);
			const nextCol = getRawIndexForVisualColumn(
				codeBlock.code[nextRow] || '',
				visualCol,
				tabStopsByLine[nextRow] || []
			);
			newPosition = [nextRow, nextCol];
		} else {
			newPosition = moveCaret(codeBlock.code, codeBlock.cursor.row, codeBlock.cursor.col, event.direction);
		}
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', newPosition[0]);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.col', newPosition[1]);
	};

	const onDeleteBackward = () => {
		if (state.editorMode !== 'edit') {
			return;
		}

		if (!state.codeBlockRendering.selectedCodeBlock) {
			return;
		}

		const codeBlock = state.codeBlockRendering.selectedCodeBlock;
		const bp = backSpace(codeBlock.code, codeBlock.cursor.row, codeBlock.cursor.col);
		const codeChanged = bp.code !== codeBlock.code;
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', bp.row);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.col', bp.col);
		store.set('codeBlockRendering.selectedCodeBlock.code', bp.code);
		store.set('codeBlockRendering.selectedCodeBlock.lastUpdated', Date.now());
		if (codeChanged) {
			incrementCompilerInputRevision(store);
			publishProjectChange(store);
		}
	};

	const onInsertNewLine = () => {
		if (state.editorMode !== 'edit') {
			return;
		}

		if (!state.codeBlockRendering.selectedCodeBlock) {
			return;
		}

		const codeBlock = state.codeBlockRendering.selectedCodeBlock;
		const ent = enter(codeBlock.code, codeBlock.cursor.row, codeBlock.cursor.col);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', ent.row);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.col', ent.col);
		store.set('codeBlockRendering.selectedCodeBlock.code', ent.code);
		store.set('codeBlockRendering.selectedCodeBlock.lastUpdated', Date.now());
		incrementCompilerInputRevision(store);
		publishProjectChange(store);
	};

	const onInsertText = (event: InsertTextEvent) => {
		if (state.editorMode !== 'edit') {
			return;
		}

		if (!state.codeBlockRendering.selectedCodeBlock) {
			return;
		}

		const codeBlock = state.codeBlockRendering.selectedCodeBlock;
		const bp = type(codeBlock.code, codeBlock.cursor.row, codeBlock.cursor.col, event.text);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', bp.row);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.col', bp.col);
		store.set('codeBlockRendering.selectedCodeBlock.code', bp.code);
		store.set('codeBlockRendering.selectedCodeBlock.lastUpdated', Date.now());
		if (event.text.length > 0) {
			incrementCompilerInputRevision(store);
			publishProjectChange(store);
		}
	};

	events.on<MoveCaretEvent>('moveCaret', onMoveCaret);
	events.on('deleteBackward', onDeleteBackward);
	events.on('insertNewLine', onInsertNewLine);
	events.on<InsertTextEvent>('insertText', onInsertText);
}
