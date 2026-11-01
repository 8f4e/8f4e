import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { resolveViewportAnchoredPosition } from './resolve';

function syncViewportAnchoredBlockList(state: State): void {
	state.codeBlockRendering.viewportAnchoredCodeBlocks = state.codeBlockRendering.codeBlocks.filter(
		block => block.viewportAnchor !== undefined
	);
}

function syncViewportAnchoredBlock(state: State, block: CodeBlockGraphicData | undefined): void {
	if (!block) {
		return;
	}

	const anchoredBlocks = state.codeBlockRendering.viewportAnchoredCodeBlocks;
	const existingIndex = anchoredBlocks.indexOf(block);

	if (block.viewportAnchor) {
		if (existingIndex === -1) {
			anchoredBlocks.push(block);
		}
		return;
	}

	if (existingIndex !== -1) {
		anchoredBlocks.splice(existingIndex, 1);
	}
}

function recomputeViewportAnchoredPositions(state: State): void {
	for (const codeBlock of state.codeBlockRendering.viewportAnchoredCodeBlocks) {
		recomputeViewportAnchoredPosition(state, codeBlock);
	}
}

function recomputeViewportAnchoredPosition(state: State, block: CodeBlockGraphicData | undefined): void {
	if (!block || !block.viewportAnchor || block === state.codeBlockRendering.draggedCodeBlock) {
		return;
	}

	const pos = resolveViewportAnchoredPosition({
		anchor: block.viewportAnchor,
		posX: block.gridX,
		posY: block.gridY,
		viewportX: state.viewport.x,
		viewportY: state.viewport.y,
		viewportWidth: state.viewport.roundedWidth,
		viewportHeight: state.viewport.roundedHeight,
		blockWidth: block.width,
		blockHeight: block.height,
		vGrid: state.viewport.vGrid,
		hGrid: state.viewport.hGrid,
	});
	block.x = pos.x;
	block.y = pos.y;
}

export default function viewportDirectiveEffect(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();

	const syncAllBlocks = () => {
		syncViewportAnchoredBlockList(state);
		recomputeViewportAnchoredPositions(state);
	};

	const syncSelectedCodeBlock = () => {
		syncViewportAnchoredBlock(state, state.codeBlockRendering.selectedCodeBlock);
		recomputeViewportAnchoredPosition(state, state.codeBlockRendering.selectedCodeBlock);
	};

	const syncProgrammaticSelectedCodeBlock = () => {
		syncViewportAnchoredBlock(state, state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit);
		recomputeViewportAnchoredPosition(state, state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit);
	};

	const recomputeAnchoredPositions = () => {
		recomputeViewportAnchoredPositions(state);
	};

	store.subscribe('codeBlockRendering.codeBlocks', syncAllBlocks);
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', syncSelectedCodeBlock);
	store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', syncProgrammaticSelectedCodeBlock);
	events.on('codeBlockLayoutsChanged', syncAllBlocks);
	events.on('spriteSheetRerendered', recomputeAnchoredPositions);
	events.on('viewportChanged', recomputeAnchoredPositions);
	events.on('viewportResized', recomputeAnchoredPositions);
}
