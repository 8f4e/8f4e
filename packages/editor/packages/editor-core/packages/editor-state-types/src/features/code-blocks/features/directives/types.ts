import type { CodeBlockGraphicData, State } from '../../../../index';
import type { ViewportBlockAlignment } from '../../../viewport/blockAlignment';
import type { CodeBlockDisplayModel } from '../../buildDisplayModel';

export interface ParsedEditorDirective {
	name: string;
	rawRow: number;
	args: string[];
	sourceLine?: string;
}

export interface DirectiveLayoutContribution {
	rawRow: number;
	rows: number;
}

export type ViewportAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface DirectiveBlockState {
	disabled: boolean;
	isHome: boolean;
	/** Effective viewport alignment for `; @home [alignment]`. Present only when the block is a valid home block. */
	homeAlignment?: ViewportBlockAlignment;
	isFavorite: boolean;
	/** Group identifier set by `; @group <name> [nonstick]`. Undefined when no valid @group directive is present. */
	groupName?: string;
	/** When true the block may be dragged independently within its group (nonstick mode). */
	groupNonstick?: boolean;
	/** Viewport anchor set by `; @viewport <corner>`. When present, @pos is interpreted as inward offset from this corner. */
	viewportAnchor?: ViewportAnchor;
	/** When true the block is always rendered above normal blocks. Set by `; @alwaysOnTop`. */
	alwaysOnTop?: boolean;
}

export interface DirectiveDisplayState {
	hideAfterRawRow?: number;
}

export interface DirectiveLayoutCallbacks {
	beforeGraphicDataWidthCalculation?: (
		graphicData: CodeBlockGraphicData,
		state: State,
		directiveState: DirectiveDerivedState
	) => void;
	/** Run after block dimensions, display rows, gaps, and cursor coordinates are current. */
	onBlockLayoutReady?: (graphicData: CodeBlockGraphicData, state: State, directiveState: DirectiveDerivedState) => void;
}

export interface DirectiveDerivedState {
	blockState: DirectiveBlockState;
	displayState: DirectiveDisplayState;
	displayModel: CodeBlockDisplayModel;
	layoutContributions: DirectiveLayoutContribution[];
	layoutCallbacks: DirectiveLayoutCallbacks[];
}

export interface DirectiveDerivedStateDraft extends DirectiveDerivedState {
	sourceCode: string[];
	state?: State;
}

export interface DirectiveDeriveOptions {
	isExpandedForEditing?: boolean;
	state?: State;
}

export interface EditorDirectivePlugin {
	name: string;
	aliases?: string[];
	allowTrailingComment?: boolean;
	clearGraphicData?: (graphicData: CodeBlockGraphicData) => void;
	apply?: (directive: ParsedEditorDirective, draft: DirectiveDerivedStateDraft) => void;
}

export interface EditorDirectiveRegistry {
	register: (directive: EditorDirectivePlugin) => () => void;
}
