import type { CodeBlockLayoutsChangedEvent } from '../features/code-blocks/layout';
import type { EditorCodeBlock, ProjectLevel } from '../features/code-blocks/types';
import type { ProgramArtifacts } from '../features/program-compiler/types';
import type { Position } from './types';

/** Availability of the optional project history actions. */
export interface EditorHistoryAvailability {
	canUndo: boolean;
	canRedo: boolean;
}

/** Core lifecycle notifications. Plugin action names remain open and infer payloads from their handlers. */
export interface EditorLifecycleEvents {
	/** Prepare initial project source before the font atlas or grid becomes available. Handlers must not await rendering or geometry. */
	prepareInitialProject: void;
	/** Initial project, grid, and viewport have settled and the first frame has drawn. */
	ready: void;
	dispose: void;
	beforeProjectEdit: void;
	/** Synchronous query populated by the installed undo/redo provider. Defaults to no available actions. */
	resolveHistoryAvailability: EditorHistoryAvailability;
	compilationSucceeded: ProgramArtifacts;
	codeBlockLayoutContributionsChanged: { codeBlock?: EditorCodeBlock };
	codeBlockLayoutsChanged: CodeBlockLayoutsChangedEvent;
	gridSizeChanged: void;
	/** Resolve first-visit placement after the destination project source and layout have settled. */
	resolveInitialProjectViewport: { level: ProjectLevel; position: Position };
	/** The logical viewport has reached the supplied coordinates. The source describes the operation, not timing. */
	viewportChanged: { previousX: number; previousY: number; x: number; y: number; source?: 'navigation' | 'pan' };
}

export type EditorEventPayload<Name extends string, Payload = unknown> = Name extends keyof EditorLifecycleEvents
	? EditorLifecycleEvents[Name]
	: Payload;

export type EditorEventArguments<Name extends string, Payload = unknown, Options = never> =
	void extends EditorEventPayload<Name, Payload>
		? [eventObject?: EditorEventPayload<Name, Payload>, options?: Options]
		: [eventObject: EditorEventPayload<Name, Payload>, options?: Options];
