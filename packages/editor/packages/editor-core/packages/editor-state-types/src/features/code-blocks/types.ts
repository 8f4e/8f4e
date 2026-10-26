/**
 * Types for code-blocks feature - manages code block entities, rendering, and interactions.
 */

import type { DocumentBlockType, PlannedMemoryDeclaration, ProjectGroupPath } from '@8f4e/language-spec';
import type { FillSpriteColorName } from '@8f4e/sprite-generator';
import type { ViewportBlockAlignment } from '../viewport/blockAlignment';
import type { CodeBlockDisplayModel } from './buildDisplayModel';

/**
 * The type of a code block, determined by its content markers.
 * - 'module': Contains module/moduleEnd markers (compiled to WASM)
 * - 'function': Contains function/functionEnd markers (compiled to WASM as reusable helper)
 * - 'constants': Contains constants/constantsEnd markers
 * - 'note': Contains note/noteEnd markers (editor-only notes, not compiled)
 * - 'unknown': Mixed or incomplete markers, or no recognizable markers
 */
export type CodeBlockType = DocumentBlockType | 'unknown';

// Forward declarations for circular dependencies
export interface Input {
	codeBlock: CodeBlockGraphicData;
	width: number;
	height: number;
	x: number;
	y: number;
	wireX: number;
	wireY: number;
	id: string;
	allocationUnitAddress: number;
}

export interface Output {
	codeBlock: CodeBlockGraphicData;
	width: number;
	height: number;
	x: number;
	y: number;
	wireX: number;
	wireY: number;
	id: string;
	calibratedMax: number;
	calibratedMin: number;
	memory: PlannedMemoryDeclaration;
}

export interface Debugger {
	width: number;
	height: number;
	showAddress: boolean;
	showEndAddress: boolean;
	x: number;
	y: number;
	id: string;
	memory?: PlannedMemoryDeclaration;
	bufferPointer: number;
	displayFormat: 'decimal' | 'binary' | 'hex';
	text?: string;
}

export interface InfoPanel {
	width: number;
	height: number;
	x: number;
	y: number;
	id: string;
	rowCount: number;
	keyColumnWidth: number;
}

export interface MemoryIdentifier {
	memory: PlannedMemoryDeclaration;
	showAddress: boolean;
	showEndAddress: boolean;
	bufferPointer: number;
	displayFormat: 'decimal' | 'binary' | 'hex';
}

export interface ArrayPlotter {
	width: number;
	height: number;
	x: number;
	y: number;
	minValue: number;
	maxValue: number;
	startAddress: MemoryIdentifier;
	baseSampleShift: 0 | 1 | 2 | 3;
	length: number | MemoryIdentifier;
	valueType: TypedValueKind;
}

export interface ArrayBars {
	width: number;
	height: number;
	x: number;
	y: number;
	minValue: number;
	maxValue: number;
	inverseValueRange: number;
	staticBaseValueIndex?: number;
	staticColumnLayout?: Array<{
		x: number;
		width: number;
		sliceStart: number;
		sliceEnd: number;
	}>;
	startAddress: MemoryIdentifier;
	baseSampleShift: 0 | 1 | 2 | 3;
	length: number | MemoryIdentifier;
	valueType: TypedValueKind;
}

export interface ArrayMeter {
	width: number;
	height: number;
	x: number;
	y: number;
	minValue: number;
	maxValue: number;
	isBipolar: boolean;
	amplitudeLimit: number;
	inverseValueRange: number;
	greenEndX: number;
	yellowEndX: number;
	overloadMarkerX: number;
	overloadMarkerWidth: number;
	staticValueIndex?: number;
	memory: MemoryIdentifier;
	baseSampleShift: 0 | 1 | 2 | 3;
	valueType: TypedValueKind;
}

export interface PianoKeyboard {
	x: number;
	y: number;
	width: number;
	height: number;
	keyWidth: number;
	keyY: number;
	keyHeight: number;
	blackKeyHeight: number;
	blackKeySideY: number;
	blackKeySideHeight: number;
	blackKeyGapXOffset: number;
	blackKeyGapY: number;
	blackKeyGapWidth: number;
	blackKeyGapHeight: number;
	lineNumber: number;
	keys: PianoKeyboardKey[];
	pressedKeysListMemory: PlannedMemoryDeclaration;
	pressedNumberOfKeysMemory: PlannedMemoryDeclaration;
	pressedKeysListModuleId: string;
	pressedNumberOfKeysModuleId: string;
	startingNumber: number;
}

export type PianoKeySprite = 'pianoKeyWhite' | 'pianoKeyBlack';
export type PianoPressedOverlayFont = 'fontPianoKeyWhitePressedOverlay' | 'fontPianoKeyBlackPressedOverlay';

interface PianoKeyboardKeyBase {
	offset: number;
	x: number;
	label: string;
	labelX: number;
	labelY: number;
	pressedOverlayX: number;
	pressedOverlayRows: number[];
}

export interface PianoKeyboardWhiteKey extends PianoKeyboardKeyBase {
	kind: 'white';
	sprite: 'pianoKeyWhite';
	pressedOverlayFont: 'fontPianoKeyWhitePressedOverlay';
}

export interface PianoKeyboardBlackKey extends PianoKeyboardKeyBase {
	kind: 'black';
	sprite: 'pianoKeyBlack';
	pressedOverlayFont: 'fontPianoKeyBlackPressedOverlay';
}

export type PianoKeyboardKey = PianoKeyboardWhiteKey | PianoKeyboardBlackKey;

export type TypedValueKind = 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'float32' | 'float64';

export interface Slider {
	/** Canonical owner of the backing declaration, including for exposed aliases. */
	moduleId: string;
	width: number;
	height: number;
	x: number;
	y: number;
	id: string;
	allocationUnitAddress: number;
	byteAddress: number;
	isInteger: boolean;
	isFloat64?: boolean;
	min: number;
	max: number;
	step?: number;
}

export interface Crossfade {
	width: number;
	height: number;
	x: number;
	y: number;
	leftId: string;
	rightId: string;
	leftWordAddress: number;
	rightWordAddress: number;
	handleWidth: number;
	trackWidth: number;
	centerX: number;
}

export interface ShapeDeclaration {
	x: number;
	y: number;
	text: string;
}

/**
 * A single parsed directive record found in a code block's raw lines.
 * Covers editor directives (`; @name`).
 * Multiple records may come from the same source line when directives are
 * chained in one comment.
 */
export interface ParsedDirectiveRecord {
	/** Directive prefix. */
	prefix: '@';
	/** Directive name (the word immediately after the prefix) */
	name: string;
	/** Whitespace-split arguments after the name */
	args: string[];
	/** Zero-based raw line index within the code block */
	rawRow: number;
	/** Original source line that contained the directive */
	sourceLine?: string;
	/** True when the directive appears as a trailing inline comment on a non-directive line */
	isTrailing: boolean;
}

/**
 * Runtime graphic data for a code block.
 * Contains all information needed to render and interact with a code block.
 */
export interface CodeBlockGraphicData {
	width: number;
	height: number;
	code: string[];
	/** True for the root project's directly owned project-scope source. */
	isProjectScope?: boolean;
	lineNumberColumnWidth: number;
	/** Logical rows currently presented by the editor, before render-only glyph resolution. */
	displayModel: CodeBlockDisplayModel;
	/** The gaps between lines */
	gaps: Map<number, { size: number }>;
	/** Optional minimum grid width override (e.g., for piano keyboards) */
	minGridWidth?: number;
	cursor: {
		/** The column of the cursor */
		col: number;
		/** The row of the cursor */
		row: number;
		/** The x position of the cursor calculated considering the grid and the line numbers. */
		x: number;
		/** The y position of the cursor calculated considering the grid and the gaps between lines. */
		y: number;
	};
	/** Human/source-facing block name derived from the block opener line. */
	name: string;
	/** Grid-space X coordinate (source of truth for horizontal position). Pixel X = gridX * vGrid */
	gridX: number;
	/** Grid-space Y coordinate (source of truth for vertical position). Pixel Y = gridY * hGrid */
	gridY: number;
	/** Pixel-space X coordinate, computed from gridX * vGrid (where vGrid = characterWidth) */
	x: number;
	/** Pixel-space Y coordinate, computed from gridY * hGrid (where hGrid = characterHeight) */
	y: number;
	widgets: {
		/** Rectangles covering executed assertion line numbers; failure takes precedence across repeated calls. */
		assertions: Array<{ lineNumber: number; passed: boolean; x: number; y: number; width: number; height: number }>;
		blockHighlights: Array<{
			x: number;
			y: number;
			height: number;
			width: number;
			color: FillSpriteColorName;
		}>;
		inputs: Input[];
		outputs: Output[];
		debuggers: Debugger[];
		arrayPlotters: ArrayPlotter[];
		arrayBars: ArrayBars[];
		arrayMeters: ArrayMeter[];
		infoPanels: InfoPanel[];
		sliders: Slider[];
		crossfades: Crossfade[];
		pianoKeyboards: PianoKeyboard[];
		shapeDeclarations: ShapeDeclaration[];
		errorMessages: Array<{
			message: string[];
			x: number;
			y: number;
			lineNumber: number;
		}>;
	};
	lastUpdated: number;
	/**
	 * True when the block is currently rendered in a collapsed form.
	 */
	isCollapsed: boolean;
	/**
	 * Monotonically increasing index assigned when the code block is created.
	 * Used to maintain stable ordering for compiler module list.
	 * This is a runtime-only value and is NOT persisted.
	 */
	creationIndex: number;
	/**
	 * The type of the code block, determined by its content markers.
	 * Updated automatically when code changes.
	 */
	blockType: CodeBlockType;
	/**
	 * Execution entry name used by module and project-group blocks in the compiler export pipeline.
	 * This is separate from the visual `; @group` directive.
	 */
	entry?: string;
	/** Canonical path of the project group that owns this block. */
	projectPath: ProjectGroupPath;
	/** Child project slice owned by a project-group block. Its array identity remains stable while editing. */
	nestedProjectCodeBlocks?: CodeBlockGraphicData[];
	/**
	 * When true, the block is excluded from compilation and rendered with a transparent background.
	 * Defaults to false.
	 */
	disabled: boolean;
	/**
	 * Optional group name for the code block, derived from ; @group directive.
	 * Blocks with the same group name move together by default during drag.
	 */
	groupName?: string;
	/**
	 * Optional flag indicating whether the group should override default grouped drag behavior.
	 * When true, blocks in this group drag individually by default (Alt key reverses to group drag).
	 * When false/undefined, blocks in this group drag together by default (Alt key reverses to single-block drag).
	 * Derived from the optional 'nonstick' keyword in ; @group directive.
	 */
	groupNonstick?: boolean;
	/**
	 * When true, marks this block as the home block for initial viewport placement.
	 * The viewport centers on the first block with isHome=true when a project loads.
	 * Derived from ; @home directive.
	 * Defaults to false.
	 */
	isHome: boolean;
	/**
	 * Optional viewport alignment hint derived from `; @home [center|left|right|top|bottom]`.
	 * When omitted, home navigation falls back to centered placement.
	 */
	homeAlignment?: ViewportBlockAlignment;
	/**
	 * When true, marks this block as a favorite for quick navigation.
	 * Derived from ; @favorite directive.
	 * Defaults to false.
	 */
	isFavorite: boolean;
	/**
	 * Parsed directive records derived from this block's code lines during the central update pass.
	 * Covers editor directives (`; @name`).
	 * Populated once per update; consumers should prefer these over rescanning raw code lines.
	 */
	parsedDirectives: ParsedDirectiveRecord[];
	/**
	 * Viewport anchor set by `; @viewport <corner>`.
	 * When present, `@pos` is interpreted as an inward offset from the specified viewport corner,
	 * and `gridX`/`gridY` store those anchored offsets rather than world-space grid coordinates.
	 * Undefined when no valid `@viewport` directive is present (world-space placement).
	 */
	viewportAnchor?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	/**
	 * When true, this block belongs to the always-on-top z-order partition and renders above
	 * all normal blocks. Set by `; @alwaysOnTop`. Defaults to false.
	 */
	alwaysOnTop: boolean;
}

export interface CodeBlockEntryOutline {
	entryName: string;
	topLeft: { x: number; y: number };
	topRight: { x: number; y: number };
	bottomRight: { x: number; y: number };
	bottomLeft: { x: number; y: number };
}

/**
 * Code block rendering state for rendering code blocks and UI elements.
 */
export type CodeBlockRendering = {
	outputsByWordAddress: Map<number, Output>;
	/** Recursive project-tree root. Project-owned array identities remain stable while editing. */
	rootCodeBlocks: CodeBlockGraphicData[];
	/** Direct pointer to the project slice currently rendered by the editor. */
	codeBlocks: CodeBlockGraphicData[];
	/**
	 * Derived outline corners for execution entries containing visible module or project-group blocks.
	 * Maintained from code block geometry so renderers can draw entry grouping without
	 * recomputing relationships every frame.
	 */
	entryOutlines: CodeBlockEntryOutline[];
	/**
	 * Subset of codeBlocks that have a `@viewport` directive.
	 * Maintained in sync with codeBlocks so that viewport move/resize handlers
	 * only iterate this smaller list instead of the full block array.
	 */
	viewportAnchoredCodeBlocks: CodeBlockGraphicData[];
	/**
	 * Monotonically increasing counter for assigning creationIndex to new code blocks.
	 * Incremented each time a new code block is created.
	 * This is a runtime-only value and is NOT persisted.
	 */
	nextCodeBlockCreationIndex: number;
	draggedCodeBlock?: CodeBlockGraphicData;
	selectedCodeBlock?: CodeBlockGraphicData;
	/**
	 * Target for refreshing and saving a block after a programmatic update, including editor metadata.
	 * Compiler input changes separately advance compilerInputRevision.
	 */
	selectedCodeBlockForProgrammaticEdit?: CodeBlockGraphicData;
};
