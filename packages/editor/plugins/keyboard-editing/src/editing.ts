import type { EditorPluginContext } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import deleteBackward from './deleteBackward';
import insertCharacter from './insertCharacter';
import insertNewLine from './insertNewLine';

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
	let edit: ReturnType<typeof insertCharacter>;
	if (key === 'Backspace') edit = deleteBackward(block.code, block.cursor.row, block.cursor.col);
	else if (key === 'Enter') edit = insertNewLine(block.code, block.cursor.row, block.cursor.col);
	else if (key === 'Tab' || (key.length === 1 && !event.altKey)) {
		edit = insertCharacter(block.code, block.cursor.row, block.cursor.col, key === 'Tab' ? '\t' : key);
	} else return;
	event.preventDefault();
	store.set('codeBlockRendering.selectedCodeBlock.cursor.row', edit.row);
	store.set('codeBlockRendering.selectedCodeBlock.cursor.col', edit.col);
	applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: edit.code }], { affectsCompilation: true });
}
