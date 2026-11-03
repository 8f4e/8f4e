import type { EditorPluginContext } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import backSpace from './backSpace';
import enter from './enter';
import type from './type';

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
	let edit: ReturnType<typeof type>;
	if (key === 'Backspace') edit = backSpace(block.code, block.cursor.row, block.cursor.col);
	else if (key === 'Enter') edit = enter(block.code, block.cursor.row, block.cursor.col);
	else if (key === 'Tab' || (key.length === 1 && !event.altKey)) {
		edit = type(block.code, block.cursor.row, block.cursor.col, key === 'Tab' ? '\t' : key);
	} else return;
	event.preventDefault();
	store.set('codeBlockRendering.selectedCodeBlock.cursor.row', edit.row);
	store.set('codeBlockRendering.selectedCodeBlock.cursor.col', edit.col);
	applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: edit.code }], { affectsCompilation: true });
}
