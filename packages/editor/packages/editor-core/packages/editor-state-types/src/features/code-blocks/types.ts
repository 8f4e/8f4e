/**
 * Types for code-blocks feature - manages code block entities, rendering, and interactions.
 */

import type {
	DocumentBlockType,
	PlannedMemoryDeclaration,
	ProjectEntryName,
	ProjectGroupPath,
} from '@8f4e/language-spec';
import type { Position } from '../../shared/types';
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

export interface MemoryIdentifier {
	memory: PlannedMemoryDeclaration;
	showAddress: boolean;
	bufferPointer: number;
}

export type TypedValueKind = 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'float32' | 'float64';

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
	sourceLineIndex: number;
	/** Original source line that contained the directive */
	sourceLine: string;
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
	/** Optional minimum grid width contributed before block layout. */
	minGridWidth?: number;
	cursor: {
		/** Raw source column shared by editing and selection. */
		col: number;
		/** Source line shared by editing and selection. */
		row: number;
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
	/** Child project level owned by a language-level project-group block. */
	childProject?: ProjectLevel;
	/**
	 * When true, the block is excluded from compilation and rendered with a transparent background.
	 * Defaults to false.
	 */
	disabled: boolean;
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

/** World-space entry regions used for insertion and shared with presentation plugins. */
export interface EntryBounds {
	entryName: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** An editor-owned project level. Remembered views and selections live only in browser memory. */
export interface ProjectLevel {
	/** Entry definitions local to this level, including empty entries. */
	entries: ProjectEntryName[];
	path: ProjectGroupPath;
	blocks: CodeBlockGraphicData[];
	viewport?: Position;
	selectedBlock?: CodeBlockGraphicData;
}

/**
 * Code block rendering state for rendering code blocks and UI elements.
 */
export type CodeBlockRendering = {
	/** Recursive project-tree root. */
	rootProject: ProjectLevel;
	/** Direct reference to the project level currently rendered by the editor. */
	currentProject: ProjectLevel;
	/** Padded bounds of entries containing modules or project groups in the current level. */
	entryBounds: EntryBounds[];
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
