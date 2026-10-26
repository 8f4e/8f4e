/**
 * Central type re-exports for editor-state.
 * This file now acts as a barrel, importing types from feature-specific modules
 * and re-exporting them for backward compatibility and public API stability.
 */

import type {
	CompileProjectOptions,
	MemoryAction as CompilerMemoryAction,
	ProjectObjectModel,
} from '@8f4e/language-spec';
import type { SpriteIdLookups } from '@8f4e/sprite-generator';
import type { AssertionResult } from './features/assertions/types';
import type { BinaryAsset } from './features/binary-assets/types';
import type {
	ArrayBars,
	ArrayMeter,
	ArrayPlotter,
	CodeBlockEntryOutline,
	CodeBlockGraphicData,
	CodeBlockRendering,
	CodeBlockType,
	Crossfade,
	Debugger,
	InfoPanel,
	Input,
	MemoryIdentifier,
	Output,
	ParsedDirectiveRecord,
	TypedValueKind,
} from './features/code-blocks/types';
import type { InsertTextEvent, MoveCaretEvent, NavigateCodeBlockEvent } from './features/code-editing/types';
import type { DialogButton, DialogButtonState, DialogContent, DialogState } from './features/dialog/types';
import type {
	EditorConfig,
	EditorConfigSchemaContributionRegistry,
	EditorConfigValidatorRegistry,
	JSONSchemaLike,
} from './features/editor-config/types';
import type { ResolvedGlobalEditorDirectives } from './features/global-editor-directives/types';
import type { ConsoleState, LogMessage } from './features/logger/types';
import type { ContextMenu, ContextMenuItem, MenuGenerator, MenuStackEntry } from './features/menu/types';
import type { CompilationResult, Compiler } from './features/program-compiler/types';
import type {
	RuntimeEnvConstantsContributor,
	RuntimeFactory,
	RuntimeRegistry,
	RuntimeRegistryEntry,
	RuntimeValuesByRuntimeId,
} from './features/runtime/types';
import type { ProjectViewport, Viewport, ViewportAnimation } from './features/viewport/types';
import type {
	CodeError,
	EventDispatcher,
	EventSubscriptionOptions,
	GridCoordinates,
	InternalKeyboardEvent,
	InternalMouseEvent,
	Position,
	Size,
} from './shared/types';

// Re-export MemoryAction for use by consumers
// Re-export shared types
// Re-export viewport types
// Re-export code-blocks types
// Re-export menu types
// Re-export program-language spec
// Re-export dialog types
// Re-export global-editor-directives types
// Re-export runtime types
// Re-export logger types
// Re-export binary-assets types
// Re-export code-editing types
// Re-export project-import types
export type {
	ArrayBars,
	ArrayMeter,
	ArrayPlotter,
	AssertionResult,
	BinaryAsset,
	CodeBlockEntryOutline,
	CodeBlockGraphicData,
	CodeBlockRendering,
	CodeBlockType,
	CodeError,
	CompilationResult,
	Compiler,
	CompilerMemoryAction as MemoryAction,
	ConsoleState,
	ContextMenu,
	ContextMenuItem,
	Crossfade,
	Debugger,
	DialogButton,
	DialogButtonState,
	DialogContent,
	DialogState,
	EventDispatcher,
	EventSubscriptionOptions,
	GridCoordinates,
	InfoPanel,
	Input,
	InsertTextEvent,
	InternalKeyboardEvent,
	InternalMouseEvent,
	JSONSchemaLike,
	LogMessage,
	MemoryIdentifier,
	MenuGenerator,
	MenuStackEntry,
	MoveCaretEvent,
	NavigateCodeBlockEvent,
	Output,
	ParsedDirectiveRecord,
	Position,
	ProjectViewport,
	ResolvedGlobalEditorDirectives,
	RuntimeEnvConstantsContributor,
	RuntimeFactory,
	RuntimeRegistry,
	RuntimeRegistryEntry,
	RuntimeValuesByRuntimeId,
	Size,
	TypedValueKind,
};

export type InfoValue = unknown;
export type InfoRecord = Record<string, InfoValue>;
export type InfoState = Record<string, InfoRecord | undefined>;

// Feature Flags types (top-level public API)
export interface FeatureFlags {
	/** Enable/disable right-click context menu functionality */
	contextMenu: boolean;

	/** Enable/disable dragging and repositioning of code block modules */
	moduleDragging: boolean;

	/** Enable/disable selecting lines/caret positions within code blocks */
	codeLineSelection: boolean;

	/** Enable/disable panning/scrolling of the editor viewport */
	viewportDragging: boolean;

	/** Whether the editor is currently in an edit-enabled state. */
	editing: boolean;

	/** Enable/disable keyboard switching into and out of edit mode. */
	modeToggling: boolean;

	/** Enable/disable the mode hint overlay at the top of the viewport */
	modeOverlay: boolean;

	/** Enable/disable history tracking for undo/redo functionality */
	historyTracking?: boolean;

	/** Enable/disable arrows that point toward off-screen code blocks */
	offscreenBlockArrows: boolean;

	/** Enable/disable the menu action that opens projects from disk */
	projectOpening: boolean;

	/** Enable/disable the menu action that creates a new project */
	projectCreation: boolean;
}

/**
 * Type for partial feature flags used in editor configuration.
 * This allows users to specify only the flags they want to override.
 */
export type FeatureFlagsConfig = Partial<FeatureFlags>;

export type EditorMode = 'view' | 'edit';

// Callbacks interface contains all callback functions (top-level public API)
export interface Callbacks {
	// Module and project loading callbacks
	getListOfModules?: () => Promise<
		Array<{
			slug: string;
			title: string;
			description?: string;
			category: string;
			dependencies?: string[];
		}>
	>;
	getModule?: (slug: string) => Promise<string>;
	getModuleDependencies?: (slug: string) => Promise<string[]>;
	getProject?: (url: string) => Promise<string>;

	// Compilation callback
	compileCode?: (project: ProjectObjectModel, compilerOptions: CompileProjectOptions) => Promise<CompilationResult>;
	resolveInclude?: (includeId: string) => Promise<string | undefined>;

	// Session storage callbacks
	loadSession: () => Promise<ProjectObjectModel | null>;
	saveSession?: (project: ProjectObjectModel) => Promise<void>;

	// File handling callbacks
	/** Returns null when the picker is cancelled. */
	importProject?: () => Promise<ProjectObjectModel | null>;
	/** Called for unrelated project replacements, including successful disk imports; excluded for undo/redo. */
	projectLoaded?: (project: ProjectObjectModel) => void;
	saveProject?: (data: string, fileName: string) => Promise<void>;
	exportProject?: (data: string, fileName: string) => Promise<void>;
	exportBinaryCode?: (fileName: string) => Promise<void>;
	exportCanvasScreenshot?: (fileName: string) => Promise<void>;
	getStorageQuota?: () => Promise<{ usedBytes: number; totalBytes: number }>;

	// Memory manipulation callback
	setWordInMemory?: (allocationUnitAddress: number, value: number, isInteger: boolean) => void;

	getWordFromMemory?: (allocationUnitAddress: number) => number;

	// Clipboard callbacks
	/**
	 * Reads text from the system clipboard.
	 * Used for pasting code blocks into the editor.
	 * If not provided, clipboard paste operations will be disabled.
	 *
	 * @returns Promise that resolves with the clipboard text content
	 */
	readClipboardText?: () => Promise<string>;

	/**
	 * Writes text to the system clipboard.
	 * Used for copying code blocks from the editor.
	 * If not provided, clipboard copy operations will be disabled.
	 *
	 * @param text - The text content to write to the clipboard
	 * @returns Promise that resolves when the write operation completes
	 */
	writeClipboardText?: (text: string) => Promise<void>;

	/**
	 * Schedules a frame callback for editor-state driven animations.
	 * Hosts can provide `window.requestAnimationFrame` or an equivalent scheduler.
	 */
	requestAnimationFrame?: (callback: (time: number) => void) => number;

	/**
	 * Cancels a previously scheduled animation frame callback.
	 */
	cancelAnimationFrame?: (id: number) => void;
}

// Options interface for editor initialization (top-level public API)
export type {
	EditorMenuId,
	EditorMenuItemContext,
	EditorMenuItemProvider,
	EditorMenuRegistry,
} from './features/menu/contributions';

export interface Options {
	featureFlags?: FeatureFlagsConfig;
	/** Mode used when the editor is initialized. */
	initialEditorMode?: EditorMode;
	callbacks: Callbacks;
	/**
	 * Runtime registry mapping runtime IDs to runtime implementations.
	 */
	runtimeRegistry: RuntimeRegistry;
	/** Optional host-provided schema contributions for project-level editor config. */
	editorConfigSchemaContributions?: EditorConfigSchemaContributionRegistry;
}

// State interface - complete editor state tree (top-level public API)
export interface State {
	/** Monotonic change signal for compiler inputs; selection and visual metadata do not advance it. */
	compilerInputRevision: number;
	compiler: Compiler;
	codeBlockRendering: CodeBlockRendering;
	contextMenu: ContextMenu;
	spriteLookups?: SpriteIdLookups;
	/** Arbitrary key/value records rendered by `; @info <id>` directives. */
	info: InfoState;
	callbacks: Callbacks;
	featureFlags: FeatureFlags;
	editorMode: EditorMode;
	editorConfig: EditorConfig;
	editorConfigValidators: EditorConfigValidatorRegistry;
	editorConfigSchemaContributions: EditorConfigSchemaContributionRegistry;
	historyStack: ProjectObjectModel[];
	initialProjectState?: ProjectObjectModel;
	redoStack: ProjectObjectModel[];
	storageQuota: { usedBytes: number; totalBytes: number };
	binaryAssets: BinaryAsset[];
	/** Console state for internal logging */
	console: ConsoleState;
	/** Executed assertion outcomes published by the active runtime for editor rendering. */
	assertionResults: AssertionResult[];
	runtime: {
		values: RuntimeValuesByRuntimeId;
	};
	/** Runtime registry for available runtime implementations */
	runtimeRegistry: RuntimeRegistry;
	/** Resolved global editor directives from `; @<name>` comments */
	globalEditorDirectives: ResolvedGlobalEditorDirectives;
	codeErrors: {
		compilationErrors: CodeError[];
		editorDirectiveErrors: CodeError[];
	};
	dialog: DialogState;
	dialogStack: DialogContent[];
	viewport: Viewport;
	viewportAnimation: ViewportAnimation;
}

export type * from './features/binary-assets/types';
export type * from './features/code-blocks/buildDisplayModel';
export type * from './features/code-blocks/features/directives/types';
export type * from './features/code-blocks/types';
export type * from './features/code-blocks/utils/types';
export type * from './features/code-editing/types';
export type * from './features/editor-config/types';
export type {
	EditorConfig,
	EditorConfigEntry,
	EditorConfigValidator,
	EditorConfigValidatorRegistry,
} from './features/editor-config/types';
export type * from './features/global-editor-directives/types';
export type * from './features/logger/types';
export type * from './features/menu/types';
export type * from './features/program-compiler/types';
export type * from './features/runtime/types';
export type * from './features/viewport/blockAlignment';
export type * from './features/viewport/types';
export type * from './shared/types';
