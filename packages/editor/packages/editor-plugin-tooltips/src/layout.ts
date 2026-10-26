import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { tooltipHorizontalPaddingChars } from './constants';
import type {
	SelectedLineTooltipContent,
	TooltipHighlight,
	TooltipHighlightTarget,
	TooltipLayout,
	TooltipLiveValue,
	TooltipLiveValueTarget,
	TooltipState,
} from './types';

const emptyTooltipLayout: TooltipLayout = {
	horizontalPadding: 0,
	width: 0,
	height: 0,
	x: 0,
	y: 0,
	lineX: 0,
};

/**
 * Creates the empty tooltip state used when line selection cannot show a tooltip.
 */
export function createEmptyTooltipState(): TooltipState {
	return {
		text: [],
		characters: [],
		colors: [],
		lineCount: 0,
		widthChars: 0,
		layout: { ...emptyTooltipLayout },
		highlights: [],
		liveValues: [],
		target: undefined,
		animation: {
			startedAt: undefined,
		},
	};
}

/**
 * Positions the tooltip to the left of the selected code line.
 */
function getTooltipLayout(
	content: SelectedLineTooltipContent,
	state: State,
	selectedCodeBlock: CodeBlockGraphicData
): TooltipLayout {
	const horizontalPadding = tooltipHorizontalPaddingChars * state.viewport.vGrid;
	const width = (content.widthChars + tooltipHorizontalPaddingChars * 2) * state.viewport.vGrid;
	const height = content.lineCount * state.viewport.hGrid;
	const x = -width - state.viewport.vGrid;
	const y = selectedCodeBlock.cursor.y;

	return {
		horizontalPadding,
		width,
		height,
		x,
		y,
		lineX: x + horizontalPadding,
	};
}

/**
 * Converts live-value text columns into block-relative drawer positions.
 */
function getTooltipLiveValues(
	targets: TooltipLiveValueTarget[],
	layout: TooltipLayout,
	state: State
): TooltipLiveValue[] {
	return targets.map(target => ({
		x: layout.lineX + target.column * state.viewport.vGrid,
		y: layout.y + target.lineIndex * state.viewport.hGrid,
		source: target.source,
		color: target.color,
	}));
}

/**
 * Converts tooltip highlight columns into block-relative drawer rectangles.
 */
function getTooltipHighlights(
	targets: TooltipHighlightTarget[],
	layout: TooltipLayout,
	state: State
): TooltipHighlight[] {
	return targets.map(target => ({
		x: layout.lineX + target.column * state.viewport.vGrid,
		y: layout.y + target.lineIndex * state.viewport.hGrid,
		width: target.widthChars * state.viewport.vGrid,
		height: state.viewport.hGrid,
		fillColor: target.fillColor,
	}));
}

/**
 * Combines tooltip content with viewport layout data into state.
 */
export function getTooltipState(
	content: SelectedLineTooltipContent,
	state: State,
	selectedCodeBlock: CodeBlockGraphicData,
	previous: TooltipState,
	now = performance.now()
): TooltipState {
	const layout = getTooltipLayout(content, state, selectedCodeBlock);
	const target = {
		codeBlockCreationIndex: selectedCodeBlock.creationIndex,
		lineNumber: selectedCodeBlock.cursor.row,
	};
	const previousTarget = previous.target;
	// Tooltip state also refreshes for compiler, sprite, and viewport changes. Preserve the start time for the
	// same visible line so those updates do not restart its entrance animation.
	const isSameTarget =
		previous.lineCount > 0 &&
		previousTarget?.codeBlockCreationIndex === target.codeBlockCreationIndex &&
		previousTarget.lineNumber === target.lineNumber;

	return {
		text: content.text,
		characters: content.characters,
		colors: content.colors,
		lineCount: content.lineCount,
		widthChars: content.widthChars,
		layout,
		highlights: getTooltipHighlights(content.highlightTargets, layout, state),
		liveValues: getTooltipLiveValues(content.liveValueTargets, layout, state),
		target,
		animation: {
			startedAt: isSameTarget ? previous.animation.startedAt : now,
		},
	};
}
