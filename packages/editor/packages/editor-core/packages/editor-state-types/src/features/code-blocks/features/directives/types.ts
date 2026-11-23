import type { ParsedDirectiveRecord } from '../../types';

export interface DirectiveBlockState {
	disabled: boolean;
	/** When true the block is always rendered above normal blocks. Set by `; @alwaysOnTop`. */
	alwaysOnTop: boolean;
}

export interface DirectiveDisplayState {
	hideAfterSourceLineIndex?: number;
}

/** Source and mutable directive contributions, before final display geometry is built. */
export interface DirectiveDerivedStateDraft {
	sourceCode: string[];
	blockState: DirectiveBlockState;
	displayState: DirectiveDisplayState;
}

export interface EditorDirectiveDefinition {
	name: string;
	aliases?: string[];
	apply?: (directive: ParsedDirectiveRecord, draft: DirectiveDerivedStateDraft) => void;
}

export interface EditorDirectiveRegistry {
	register: (directive: EditorDirectiveDefinition) => () => void;
}
