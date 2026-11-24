import type { EditorCodeBlock, EventDispatcher, ProjectTransactions, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import setDisabledDirective from '../directives/block/setDisabledDirective';
import { insertCodeBlock } from './insertCodeBlock';
import { applyCodeBlockSourceEdits } from './replaceBlockSources';

export default function registerBlockActionCommands(
	store: StateManager<State> & { projectTransactions: ProjectTransactions },
	events: EventDispatcher
): () => void {
	const state = store.getState();
	function onInsertCodeBlock({ x, y, code }: { x: number; y: number; code: string[] }): void {
		insertCodeBlock(store, { x, y, code });
	}

	function onToggleCodeBlockDisabled({ codeBlock }: { codeBlock: EditorCodeBlock }): void {
		if (state.editorMode !== 'edit' || codeBlock.readOnly) {
			return;
		}

		// Toggle disabled state by upserting/removing @disabled directive
		const newDisabledState = !codeBlock.disabled;
		const code = setDisabledDirective(codeBlock.code, newDisabledState);
		applyCodeBlockSourceEdits(store, [{ codeBlock, code }]);
	}

	events.on('insertCodeBlock', onInsertCodeBlock);
	events.on('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
	return () => {
		events.off('insertCodeBlock', onInsertCodeBlock);
		events.off('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
	};
}
