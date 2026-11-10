import type { CodeBlockLayoutsChangedEvent } from '../features/code-blocks/layout';
import type { CodeBlockGraphicData } from '../features/code-blocks/types';
import type { ProgramArtifacts } from '../features/program-compiler/types';

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
	viewportResized: void;
	viewportChanged: { previousX: number; previousY: number; x: number; y: number };
}

export type EditorEventPayload<Name extends string, Payload = unknown> = Name extends keyof EditorLifecycleEvents
	? EditorLifecycleEvents[Name]
	: Payload;

export type EditorEventArguments<Name extends string, Payload = unknown, Options = never> =
	void extends EditorEventPayload<Name, Payload>
		? [eventObject?: EditorEventPayload<Name, Payload>, options?: Options]
		: [eventObject: EditorEventPayload<Name, Payload>, options?: Options];
