/**
 * Central type re-exports for editor-state.
 * Shared feature types are re-exported here for editor consumers.
 */

import type { MemoryAction as CompilerMemoryAction, ProjectObjectModel } from '@8f4e/language-spec';
import type { AssertionResult } from './features/assertions/types';
import type {
	CodeBlockEntryOutline,
	CodeBlockGraphicData,
	CodeBlockRendering,
	CodeBlockType,
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
import type { Compiler } from './features/program-compiler/types';
import type {
	RuntimeEnvConstantsContributor,
	RuntimeFactory,
	RuntimeMetadataRegistry,
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
// Re-export code-editing types
// Re-export project types
export type {
	AssertionResult,
	CodeBlockEntryOutline,
	CodeBlockGraphicData,
	CodeBlockRendering,
	CodeBlockType,
	CodeError,
	Compiler,
	CompilerMemoryAction as MemoryAction,
	ConsoleState,
	ContextMenu,
	ContextMenuItem,
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
	RuntimeMetadataRegistry,
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
	// Memory manipulation callback
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
	EditorMenuItemContext,
	EditorMenuItemProvider,
	EditorMenuItemSlot,
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
	/** Monotonic change signal for persisted project content; selection, caret movement, and navigation do not advance it. */
	projectRevision: number;
	compiler: Compiler;
	codeBlockRendering: CodeBlockRendering;
	contextMenu: ContextMenu;
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
	/** Source lines contributed to the generated environment constants block, keyed by contributor. */
	envConstantContributions: Record<string, string[]>;
	/** Console state for internal logging */
	console: ConsoleState;
	/** Executed assertion outcomes published by the active runtime for editor rendering. */
	assertionResults: AssertionResult[];
	runtime: {
		values: RuntimeValuesByRuntimeId;
	};
	/** Data-only metadata for available runtimes; implementations are initialization dependencies. */
	runtimeRegistry: RuntimeMetadataRegistry;
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
