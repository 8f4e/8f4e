import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import incrementCompilerInputRevision from '../../../program-compiler/incrementCompilerInputRevision';
import { getSliderDefaultEdits } from './saveDefaults';

export default function sliderDefaultSaver(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	const onSaveSliderValuesToCode = ({ codeBlock }: { codeBlock?: CodeBlockGraphicData } = {}) => {
		if (!state.featureFlags.editing) {
			return;
		}

		const targetCodeBlock = codeBlock ?? state.codeBlockRendering.selectedCodeBlock;
		if (!targetCodeBlock) {
			return;
		}

		const edits = getSliderDefaultEdits(state, targetCodeBlock);
		if (edits.length === 0) return;

		for (const { codeBlock, code } of edits) {
			codeBlock.code = code;
			codeBlock.lastUpdated = Date.now();
			store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', codeBlock);
		}
		incrementCompilerInputRevision(store);
	};

	events.on('saveSliderValuesToCode', onSaveSliderValuesToCode);

	return () => {
		events.off('saveSliderValuesToCode', onSaveSliderValuesToCode);
	};
}
