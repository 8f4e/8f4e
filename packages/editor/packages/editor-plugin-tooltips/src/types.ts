import type { State } from '@8f4e/editor-state-types';
import type { FillSpriteColorName, SpriteFont } from '@8f4e/sprite-generator';

export type SpriteLookups = NonNullable<State['spriteLookups']>;

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
	color: SpriteFont | undefined;
}

/**
 * Highlight rectangle before viewport layout is applied.
 */
export interface TooltipHighlightTarget {
	lineIndex: number;
	column: number;
	widthChars: number;
	fillColor: FillSpriteColorName;
}

/**
 * Fully assembled selected-line tooltip content before viewport layout is applied.
 */
export interface SelectedLineTooltipContent {
	text: string[];
	characters: Array<Array<number | string>>;
	colors: Array<Array<SpriteFont | undefined>>;
	lineCount: number;
	widthChars: number;
	highlightTargets: TooltipHighlightTarget[];
	liveValueTargets: TooltipLiveValueTarget[];
}

export interface TooltipLiveValueMemoryFormat {
	elementWordSize: number;
	isInteger: boolean;
	isUnsigned: boolean;
}

export interface TooltipMemoryAddressLiveValueSource {
	kind: 'memoryAddress';
	moduleId: string;
	memoryId: string;
}

export interface TooltipMemoryValueLiveValueSource {
	kind: 'memoryValue';
	moduleId: string;
	memoryId: string;
	elementIndex?: number;
}

export interface TooltipMemoryDereferenceLiveValueSource {
	kind: 'memoryDereference';
	moduleId: string;
	memoryId: string;
	format: TooltipLiveValueMemoryFormat;
}

export type TooltipLiveValueSource =
	| TooltipMemoryAddressLiveValueSource
	| TooltipMemoryValueLiveValueSource
	| TooltipMemoryDereferenceLiveValueSource;

export interface TooltipLiveValue {
	x: number;
	y: number;
	source: TooltipLiveValueSource;
	color: SpriteFont | undefined;
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
	fillColor: FillSpriteColorName;
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
	characters: Array<Array<number | string>>;
	colors: Array<Array<SpriteFont | undefined>>;
	lineCount: number;
	widthChars: number;
	layout: TooltipLayout;
	highlights: TooltipHighlight[];
	liveValues: TooltipLiveValue[];
	target?: TooltipTarget;
	animation: TooltipAnimation;
}
