import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import parsePos from '../directives/pos/data';

/** Update grid coordinates after directive parsing and before position-dependent consumers. */
export default function positionUpdater(store: StateManager<State>): void {
	const state = store.getState();
	const updatePosition = (block: CodeBlockGraphicData | undefined): void => {
		if (!block) return;
		const position = parsePos(block.parsedDirectives);
		if (!position) return;
		block.gridX = position.x;
		block.gridY = position.y;
	};

	store.subscribe('codeBlockRendering.selectedCodeBlock.code', () => {
		updatePosition(state.codeBlockRendering.selectedCodeBlock);
	});
	store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', () => {
		updatePosition(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit);
	});
}
