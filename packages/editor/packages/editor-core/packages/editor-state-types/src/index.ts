/**
 * Central type re-exports for editor-state.
 * Shared feature types are re-exported here for editor consumers.
 */

import type { MemoryAction as CompilerMemoryAction, ProjectObjectModel } from '@8f4e/language-spec';
import type { AssertionResult } from './features/assertions/types';
import type { NavigateCodeBlockEvent } from './features/code-blocks/navigation';
import type {
	CodeBlockGraphicData,
	CodeBlockRendering,
	CodeBlockType,
	EntryBounds,
	MemoryIdentifier,
	ParsedDirectiveRecord,
	ProjectLevel,
	TypedValueKind,
} from './features/code-blocks/types';
import type { ActivateDialogButtonEvent, DialogButton, DialogContent } from './features/dialog/types';
import type {
	EditorConfig,
	EditorConfigSchemaContributionRegistry,
	EditorConfigValidatorRegistry,
	JSONSchemaLike,
} from './features/editor-config/types';
import type { ResolvedGlobalEditorDirectives } from './features/global-editor-directives/types';
import type { ConsoleState, LogMessage } from './features/logger/types';
import type {
	ActivateContextMenuItemEvent,
	ContextMenu,
	ContextMenuItem,
	MenuGenerator,
	MenuStackEntry,
} from './features/menu/types';
import type { Compiler } from './features/program-compiler/types';
import type { ProjectViewport, Viewport, ViewportAnimation } from './features/viewport/types';
import type {
	CodeBlockPointerDownEvent,
	CodeError,
	EventDispatcher,
	EventDispatchOptions,
	EventSubscriptionOptions,
	GridCoordinates,
	InternalPointerEvent,
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
// Re-export logger types
// Re-export navigation types
// Re-export project types
export type {
	ActivateContextMenuItemEvent,
	ActivateDialogButtonEvent,
	AssertionResult,
	CodeBlockGraphicData,
	CodeBlockPointerDownEvent,
	CodeBlockRendering,
	CodeBlockType,
	CodeError,
	Compiler,
	CompilerMemoryAction as MemoryAction,
	ConsoleState,
	ContextMenu,
	ContextMenuItem,
	DialogButton,
	DialogContent,
	EntryBounds,
	EventDispatcher,
	EventDispatchOptions,
	EventSubscriptionOptions,
	GridCoordinates,
	InternalPointerEvent,
	JSONSchemaLike,
	LogMessage,
	MemoryIdentifier,
	MenuGenerator,
	MenuStackEntry,
	NavigateCodeBlockEvent,
	ParsedDirectiveRecord,
	Position,
	ProjectLevel,
	ProjectViewport,
	ResolvedGlobalEditorDirectives,
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

	/** Enable/disable selecting lines/caret positions; preserved across mode changes and project replacement. */
	codeLineSelection: boolean;

	/** Enable/disable panning/scrolling of the editor viewport */
	viewportDragging: boolean;

	/** Enable/disable plugin canvas overlays and offscreen block decorations */
	canvasOverlays: boolean;

	/** Enable/disable history tracking for undo/redo functionality */
	historyTracking?: boolean;

	/** Enable/disable the menu action that creates a new project */
	projectCreation: boolean;
}

/**
 * Type for partial feature flags used in editor configuration.
 * This allows users to specify only the flags they want to override.
 */
export type FeatureFlagsConfig = Partial<FeatureFlags>;

export type EditorMode = 'view' | 'edit';

// Core-provided memory callbacks.
export interface Callbacks {
	// Memory manipulation callback
	getWordFromMemory?: (allocationUnitAddress: number) => number;
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
	callbacks: Callbacks;
	/** Optional host-provided schema contributions for project-level editor config. */
	editorConfigSchemaContributions?: EditorConfigSchemaContributionRegistry;
}

/** One completed persisted-content operation, shared by API concurrency, history, and persistence. */
export interface ProjectChange {
	revision: number;
	kind: 'edit' | 'checkpoint' | 'restore' | 'replace';
}

/** One contributed operation, retained after completion independently of presentation. */
export interface LoadingIndicator {
	id: string;
	message: string;
	status: 'loading' | 'done' | 'failed' | 'cancelled';
	/** Milliseconds since the Unix epoch, recorded when the contribution is added. */
	startedAt: number;
	/** Milliseconds since the Unix epoch, or null while the operation is loading. */
	finishedAt: number | null;
}

/** The first terminal result wins; later calls have no effect. */
export interface LoadingIndicatorHandle {
	done: () => void;
	fail: () => void;
	cancel: () => void;
}

/** Per-editor contributions to the unified loading list. Producers own their terminal result. */
export interface EditorLoadingRegistry {
	add: (indicator: Pick<LoadingIndicator, 'id' | 'message'>) => LoadingIndicatorHandle;
}

// State interface - complete editor state tree (top-level public API)
export interface State {
	/** Monotonic change signal for compiler inputs; selection and visual metadata do not advance it. */
	compilerInputRevision: number;
	/** Monotonic change signal for persisted project content; selection, caret movement, and navigation do not advance it. */
	projectChange: ProjectChange;
	compiler: Compiler;
	codeBlockRendering: CodeBlockRendering;
	contextMenu: ContextMenu;
	/** Shared information records published by the editor and plugins. */
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
	/** Executed assertion outcomes published by plugins for editor rendering. */
	assertionResults: AssertionResult[];
	/** Resolved global editor directives from `; @<name>` comments */
	globalEditorDirectives: ResolvedGlobalEditorDirectives;
	/** Raw source errors keyed by contributor. Each contributor replaces its own list. */
	codeErrors: Record<string, CodeError[]>;
	/** Contributed operations and their retained results, in insertion order. */
	loadingIndicators: LoadingIndicator[];
	dialog: DialogContent;
	dialogStack: DialogContent[];
	viewport: Viewport;
	viewportAnimation: ViewportAnimation;
}

export type * from './features/code-blocks/buildDisplayModel';
export type * from './features/code-blocks/features/directives/types';
export type * from './features/code-blocks/layout';
export type * from './features/code-blocks/navigation';
export type * from './features/code-blocks/types';
export type * from './features/code-blocks/utils/types';
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
export type * from './features/viewport/blockAlignment';
export type * from './features/viewport/types';
export type * from './shared/types';
