import type { ViewportBlockAlignment } from '../../../viewport/blockAlignment';
import type { CodeBlockDisplayModel } from '../../buildDisplayModel';

export interface ParsedEditorDirective {
	name: string;
	sourceLineIndex: number;
	args: string[];
	sourceLine?: string;
}

export type ViewportAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface DirectiveBlockState {
	disabled: boolean;
	isHome: boolean;
	/** Effective viewport alignment for `; @home [alignment]`. Present only when the block is a valid home block. */
	homeAlignment?: ViewportBlockAlignment;
	isFavorite: boolean;
	/** Viewport anchor set by `; @viewport <corner>`. When present, @pos is interpreted as inward offset from this corner. */
	viewportAnchor?: ViewportAnchor;
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

export interface DirectiveDerivedStateDraft extends DirectiveDerivedState {
	sourceCode: string[];
}

export interface DirectiveDeriveOptions {
	isExpandedForEditing?: boolean;
}

export interface EditorDirectiveDefinition {
	name: string;
	aliases?: string[];
	allowTrailingComment?: boolean;
	apply?: (directive: ParsedEditorDirective, draft: DirectiveDerivedStateDraft) => void;
}

export interface EditorDirectiveRegistry {
	register: (directive: EditorDirectiveDefinition) => () => void;
}
