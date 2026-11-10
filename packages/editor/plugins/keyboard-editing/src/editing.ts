import type { EditorPluginContext } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import type { Direction } from '@8f4e/editor-state-types';
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
	const block = state.codeBlockRendering.selectedCodeBlock;
	if (!block) return;
	const direction = directions[key];
	if (direction) {
		if (!state.featureFlags.codeLineSelection) return;
		event.preventDefault();
		const [row, col] = moveCaret(block.code, block.cursor.row, block.cursor.col, direction);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.row', row);
		store.set('codeBlockRendering.selectedCodeBlock.cursor.col', col);
		return;
	}
	let edit: ReturnType<typeof insertText>;
	if (key === 'Backspace') edit = deleteBackward(block.code, block.cursor.row, block.cursor.col);
	else if (key === 'Enter') edit = insertNewLine(block.code, block.cursor.row, block.cursor.col);
	else if (key === 'Tab' || (key.length === 1 && !event.altKey)) {
		edit = insertText(block.code, block.cursor.row, block.cursor.col, key === 'Tab' ? '\t' : key);
	} else return;
	event.preventDefault();
	store.set('codeBlockRendering.selectedCodeBlock.cursor.row', edit.row);
	store.set('codeBlockRendering.selectedCodeBlock.cursor.col', edit.col);
	applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: block, code: edit.code }], { affectsCompilation: true });
}

export function handlePaste(event: ClipboardEvent, { store, events }: EditorPluginContext): void {
	const state = store.getState();
	if (event.defaultPrevented || state.editorMode !== 'edit') return;
	const block = state.codeBlockRendering.selectedCodeBlock;
	if (!block) return;
	const text = event.clipboardData!.getData('text/plain');
	if (text.length === 0) return;
	event.preventDefault();
	const edit = insertText(block.code, block.cursor.row, block.cursor.col, text);
	store.set('codeBlockRendering.selectedCodeBlock.cursor.row', edit.row);
	store.set('codeBlockRendering.selectedCodeBlock.cursor.col', edit.col);
	applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: block, code: edit.code }], { affectsCompilation: true });
}
