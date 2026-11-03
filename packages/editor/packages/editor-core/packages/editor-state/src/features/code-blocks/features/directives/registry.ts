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
import homeDirective from './home/plugin';
import { matchEditorDirectives } from './utils';
import viewportDirective from './viewport/plugin';

export type {
	DirectiveBlockState,
	DirectiveDerivedState,
	ViewportAnchor,
} from '@8f4e/editor-state-types';

export const directiveDefinitions: EditorDirectiveDefinition[] = [
	disabledDirective,
	homeDirective,
	hideDirective,
	viewportDirective,
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

export function deriveDirectiveState(
	code: string[],
	parsedDirectives: ParsedDirectiveRecord[],
	options: DirectiveDeriveOptions = {},
	definitions: EditorDirectiveDefinition[] = directiveDefinitions
): DirectiveDerivedState {
	const directives = matchEditorDirectives(parsedDirectives, definitions);
	const draft: DirectiveDerivedStateDraft = {
		sourceCode: code,
		blockState: {
			disabled: false,
			isHome: false,
		},
		displayState: {},
		displayModel: buildDisplayModel(code),
	};

	for (const directive of directives) {
		const definition = definitions.find(candidate => candidate.name === directive.name);
		definition?.apply?.(directive, draft);
	}

	return {
		blockState: draft.blockState,
		displayState: draft.displayState,
		displayModel: buildDisplayModel(code, {
			...draft.displayState,
			isExpandedForEditing: options.isExpandedForEditing,
		}),
	};
}
