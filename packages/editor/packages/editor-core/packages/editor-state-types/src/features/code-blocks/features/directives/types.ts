import type { CodeBlockDisplayModel } from '../../buildDisplayModel';
import type { ParsedDirectiveRecord } from '../../types';

export interface DirectiveBlockState {
	disabled: boolean;
	/** When true the block is always rendered above normal blocks. Set by `; @alwaysOnTop`. */
	alwaysOnTop?: boolean;
}

export interface DirectiveDisplayState {
	hideAfterSourceLineIndex?: number;
}

export interface DirectiveDerivedState {
	blockState: DirectiveBlockState;
	displayState: DirectiveDisplayState;
	displayModel: CodeBlockDisplayModel;
}

/** Source and mutable directive contributions, before final display geometry is built. */
export interface DirectiveDerivedStateDraft {
	sourceCode: string[];
	blockState: DirectiveBlockState;
	displayState: DirectiveDisplayState;
}

export interface DirectiveDeriveOptions {
	isExpandedForEditing?: boolean;
}

export interface EditorDirectiveDefinition {
	name: string;
	aliases?: string[];
	apply?: (directive: ParsedDirectiveRecord, draft: DirectiveDerivedStateDraft) => void;
}

export interface EditorDirectiveRegistry {
	register: (directive: EditorDirectiveDefinition) => () => void;
}
