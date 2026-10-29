import type { CodeBlockDisplayModel, VerticalSpaceAfterSourceLine } from '@8f4e/editor-state-types';

export interface BlockLayoutDraft {
	displayModel: CodeBlockDisplayModel;
	verticalSpaceAfterSourceLine: VerticalSpaceAfterSourceLine[];
}
