import type { PaletteIndex, PaletteToken } from '@8f4e/editor-palette';
import type { PreparedNumericRead } from '@8f4e/editor-state/memory';
import type { GlyphIds } from '@8f4e/web-ui';

/**
 * Character range that should switch to the tooltip highlight color.
 */
export interface TooltipHighlightRange {
	start: number;
	end: number;
}

/**
 * Placeholder position for a live value that the drawer fills while rendering.
 */
export interface TooltipLiveValueTarget {
	lineIndex: number;
	column: number;
	source: TooltipLiveValueSource;
	color: PaletteIndex | undefined;
}

/**
 * Highlight rectangle before viewport layout is applied.
 */
export interface TooltipHighlightTarget {
	lineIndex: number;
	column: number;
	widthChars: number;
	fillColor: PaletteToken;
}

/**
 * Fully assembled selected-line tooltip content before viewport layout is applied.
 */
export interface SelectedLineTooltipContent {
	text: string[];
	characters: GlyphIds[];
	colors: Array<Array<PaletteIndex | undefined>>;
	lineCount: number;
	widthChars: number;
	highlightTargets: TooltipHighlightTarget[];
	liveValueTargets: TooltipLiveValueTarget[];
}

export type TooltipLiveValueSource =
	| { kind: 'staticText'; text: string }
	| { kind: 'numericRead'; read: PreparedNumericRead };

export interface TooltipLiveValue {
	x: number;
	y: number;
	source: TooltipLiveValueSource;
	color: PaletteIndex | undefined;
}

export interface TooltipLayout {
	horizontalPadding: number;
	width: number;
	height: number;
	x: number;
	y: number;
	lineX: number;
}

export interface TooltipHighlight {
	x: number;
	y: number;
	width: number;
	height: number;
	fillColor: PaletteToken;
}

export interface TooltipTarget {
	codeBlockCreationIndex: number;
	lineNumber: number;
}

export interface TooltipAnimation {
	startedAt?: number;
}

export interface TooltipState {
	text: string[];
	characters: GlyphIds[];
	colors: Array<Array<PaletteIndex | undefined>>;
	lineCount: number;
	widthChars: number;
	layout: TooltipLayout;
	highlights: TooltipHighlight[];
	liveValues: TooltipLiveValue[];
	target?: TooltipTarget;
	animation: TooltipAnimation;
}
