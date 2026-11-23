import type {
	DirectiveDerivedState,
	DirectiveDerivedStateDraft,
	DirectiveDeriveOptions,
	EditorDirectiveDefinition,
	EditorDirectiveRegistry,
	ParsedDirectiveRecord,
} from '@8f4e/editor-state-types';
import buildDisplayModel from '../../buildDisplayModel';
import alwaysOnTopDirective from './alwaysOnTop/plugin';
import disabledDirective from './disabled/plugin';
import hideDirective from './hide/plugin';
import { matchEditorDirectives } from './utils';

export type { DirectiveBlockState, DirectiveDerivedState } from '@8f4e/editor-state-types';

export const directiveDefinitions: EditorDirectiveDefinition[] = [
	disabledDirective,
	hideDirective,
	alwaysOnTopDirective,
];

export function createDirectiveRegistry(): EditorDirectiveRegistry & { definitions: EditorDirectiveDefinition[] } {
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
): Pick<DirectiveDerivedState, 'blockState' | 'displayState'> {
	const directives = matchEditorDirectives(parsedDirectives, definitions);
	const draft: DirectiveDerivedStateDraft = {
		sourceCode: code,
		blockState: {
			disabled: false,
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

export function deriveDirectiveState(
	code: string[],
	parsedDirectives: ParsedDirectiveRecord[],
	options: DirectiveDeriveOptions = {},
	definitions: EditorDirectiveDefinition[] = directiveDefinitions
): DirectiveDerivedState {
	const facts = deriveDirectiveFacts(code, parsedDirectives, definitions);
	return {
		...facts,
		displayModel: buildDisplayModel(code, {
			...facts.displayState,
			isExpandedForEditing: options.isExpandedForEditing,
		}),
	};
}
