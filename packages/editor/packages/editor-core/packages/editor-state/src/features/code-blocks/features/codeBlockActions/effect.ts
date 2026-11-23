import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { insertCodeBlock } from '../../insertCodeBlock';
import { applyCodeBlockSourceEdits } from '../../sourceEdits';
import upsertDisabled from '../directives/disabled/upsert';

export default function codeBlockActions(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	function onInsertCodeBlock({ x, y, code }: { x: number; y: number; code: string[] }): void {
		insertCodeBlock(store, { x, y, code });
	}

	function onToggleCodeBlockDisabled({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		if (state.editorMode !== 'edit') {
			return;
		}

		// Toggle disabled state by upserting/removing @disabled directive
		const newDisabledState = !codeBlock.disabled;
		const code = upsertDisabled(codeBlock.code, newDisabledState);
		applyCodeBlockSourceEdits({ store, events }, [{ codeBlock, code }]);
	}

	events.on('insertCodeBlock', onInsertCodeBlock);
	events.on('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
	return () => {
		events.off('insertCodeBlock', onInsertCodeBlock);
		events.off('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
	};
}
