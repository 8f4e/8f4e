import type { CodeBlockLayoutsChangedEvent } from '../features/code-blocks/layout';
import type { CodeBlockGraphicData, ProjectLevel } from '../features/code-blocks/types';
import type { ProgramArtifacts } from '../features/program-compiler/types';
import type { Position } from './types';

/** Core lifecycle notifications. Plugin action names remain open and infer payloads from their handlers. */
export interface EditorLifecycleEvents {
	init: void;
	ready: void;
	dispose: void;
	beforeProjectEdit: void;
	compilationInputChanged: void;
	compilationSucceeded: ProgramArtifacts;
	/** Source arrays have changed; core synchronously refreshes their derived metadata and layout. */
	codeBlockSourcesChanged: { codeBlocks: readonly CodeBlockGraphicData[] };
	codeBlockLayoutContributionsChanged: { codeBlock?: CodeBlockGraphicData };
	codeBlockLayoutsChanged: CodeBlockLayoutsChangedEvent;
	gridSizeChanged: void;
	memoryValuesChanged: void;
	/** Synchronously resolve first-visit placement after the project level's layout has settled. */
	resolveInitialProjectViewport: { project: ProjectLevel; position: Position };
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
