import type { CodeBlockGraphicData, State } from '../../index';

export interface VerticalSpaceAfterSourceLine {
	sourceLineIndex: number;
	heightInRows: number;
}

export interface CodeBlockLayoutContribution {
	verticalSpaceAfterSourceLine: readonly VerticalSpaceAfterSourceLine[];
	minGridWidth?: number;
}

export interface EditorLayoutContribution {
	update: (codeBlock: CodeBlockGraphicData, value: CodeBlockLayoutContribution) => void;
	remove: (codeBlock: CodeBlockGraphicData) => void;
	dispose: () => void;
}

export interface CodeBlockLayoutContext {
	codeBlock: CodeBlockGraphicData;
	state: State;
}

/** Only these blocks have completed source/display derivation and all pending layout contributions. */
export interface CodeBlockLayoutsChangedEvent {
	codeBlocks: readonly CodeBlockGraphicData[];
}

export interface EditorLayoutRegistry {
	createContribution: () => EditorLayoutContribution;
	/** Subscribe to calculated block layout, including the current visible blocks immediately. */
	subscribe: (listener: (context: CodeBlockLayoutContext) => void) => () => void;
}
