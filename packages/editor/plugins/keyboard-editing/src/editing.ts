import type { EditorPluginContext } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits, clampSourcePosition } from '@8f4e/editor-state';
import type { Direction, EditorCodeBlock } from '@8f4e/editor-state-types';
import deleteBackward from './deleteBackward';
import insertNewLine from './insertNewLine';
import insertText from './insertText';
import { moveCaret } from './moveCaret';

export { default as createCaretPresentation } from './drawCaret';

const directions: Record<string, Direction> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
};

function applyTextEdit(
	store: EditorPluginContext['store'],
	block: EditorCodeBlock,
	edit: ReturnType<typeof insertText>
) {
	applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: edit.code }]);
	if (store.getState().project.selectedCodeBlock !== block) return;
	const [row, col] = clampSourcePosition(block.code, edit.row, edit.col);
	store.set('project.selectedCodeBlock.cursor', { ...block.cursor, row, col });
}

export function handleKeydown(event: KeyboardEvent, { store, events }: EditorPluginContext): void {
	const state = store.getState();
	if (event.defaultPrevented || state.editorMode !== 'edit') return;
	const { key, metaKey, ctrlKey } = event;
	if (metaKey || ctrlKey) {
		const lowerKey = key.toLowerCase();
		if (lowerKey === 'z' || lowerKey === 'y') {
			event.preventDefault();
			events.dispatch(lowerKey === 'z' && !event.shiftKey ? 'undo' : 'redo');
		}
		return;
	}
	const block = state.project.selectedCodeBlock;
	if (!block) return;
	const direction = directions[key];
	if (direction) {
		if (!state.featureFlags.codeLineSelection) return;
		event.preventDefault();
		const [row, col] = moveCaret(block.code, block.tabStopsByLine, block.cursor.row, block.cursor.col, direction);
		store.set('project.selectedCodeBlock.cursor', { ...block.cursor, row, col });
		return;
	}
	if (block.readOnly) return;
	let edit: ReturnType<typeof insertText>;
	if (key === 'Backspace') edit = deleteBackward(block.code, block.cursor.row, block.cursor.col);
	else if (key === 'Enter') edit = insertNewLine(block.code, block.cursor.row, block.cursor.col);
	else if (key === 'Tab' || (key.length === 1 && !event.altKey)) {
		edit = insertText(block.code, block.cursor.row, block.cursor.col, key === 'Tab' ? '\t' : key);
	} else return;
	event.preventDefault();
	applyTextEdit(store, block, edit);
}

export function handlePaste(event: ClipboardEvent, { store }: EditorPluginContext): void {
	const state = store.getState();
	if (event.defaultPrevented || state.editorMode !== 'edit') return;
	const block = state.project.selectedCodeBlock;
	if (!block || block.readOnly) return;
	const text = event.clipboardData!.getData('text/plain');
	if (text.length === 0) return;
	event.preventDefault();
	const edit = insertText(block.code, block.cursor.row, block.cursor.col, text);
	applyTextEdit(store, block, edit);
}
