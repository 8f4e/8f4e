import type {
	DirectiveBlockState,
	DirectiveDerivedStateDraft,
	DirectiveDisplayState,
	EditorDirectiveDefinition,
	EditorDirectiveRegistry,
	ParsedDirectiveRecord,
} from '@8f4e/editor-state-types';
import alwaysOnTopDirective from './block/alwaysOnTopDirective';
import disabledDirective from './block/disabledDirective';
import hideDirective from './block/hideDirective';
import { matchEditorDirectives } from './directiveRecords';

export const directiveDefinitions: EditorDirectiveDefinition[] = [
	disabledDirective,
	hideDirective,
	alwaysOnTopDirective,
];

export function createBlockDirectiveRegistry(): EditorDirectiveRegistry & { definitions: EditorDirectiveDefinition[] } {
	const definitions = [...directiveDefinitions];
	return {
		definitions,
		register: directive => {
			definitions.push(directive);
			return () => {
				const index = definitions.indexOf(directive);
				if (index !== -1) definitions.splice(index, 1);
			};
		},
	};
}

/** Resolve source-owned directive facts without building display rows. */
export function deriveDirectiveFacts(
	code: string[],
	parsedDirectives: ParsedDirectiveRecord[],
	definitions: EditorDirectiveDefinition[] = directiveDefinitions
): { blockState: DirectiveBlockState; displayState: DirectiveDisplayState } {
	const directives = matchEditorDirectives(parsedDirectives, definitions);
	const draft: DirectiveDerivedStateDraft = {
		sourceCode: code,
		blockState: {
			disabled: false,
			alwaysOnTop: false,
		},
		displayState: {},
	};

	for (const directive of directives) {
		const definition = definitions.find(candidate => candidate.name === directive.name);
		definition?.apply?.(directive, draft);
	}

	return {
		blockState: draft.blockState,
		displayState: draft.displayState,
	};
}
