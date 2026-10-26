import type {
	CodeBlockGraphicData,
	DirectiveDerivedState,
	DirectiveDerivedStateDraft,
	DirectiveDeriveOptions,
	EditorDirectiveDefinition,
	EditorDirectiveRegistry,
	ParsedDirectiveRecord,
	State,
} from '@8f4e/editor-state-types';
import buildDisplayModel from '../../buildDisplayModel';
import alwaysOnTopDirective from './alwaysOnTop/plugin';
import barsDirective from './bars/plugin';
import crossfadeDirective from './crossfade/plugin';
import disabledDirective from './disabled/plugin';
import favoriteDirective from './favorite/plugin';
import groupDirective from './group/plugin';
import hideDirective from './hide/plugin';
import homeDirective from './home/plugin';
import infoDirective from './info/plugin';
import meterDirective from './meter/plugin';
import plotDirective from './plot/plugin';
import stackDirective from './stack/plugin';
import { normalizeEditorDirectiveRecords } from './utils';
import { createVerticalSpaceAfterSourceLineAdder } from './verticalSpaceAfterSourceLine';
import viewportDirective from './viewport/plugin';
import watchDirective from './watch/plugin';

export type {
	DirectiveBlockState,
	DirectiveDerivedState,
	ParsedEditorDirective,
	ViewportAnchor,
} from '@8f4e/editor-state-types';

export const directiveDefinitions: EditorDirectiveDefinition[] = [
	meterDirective,
	barsDirective,
	plotDirective,
	crossfadeDirective,
	watchDirective,
	stackDirective,
	infoDirective,
	disabledDirective,
	homeDirective,
	favoriteDirective,
	hideDirective,
	groupDirective,
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
	const directives = normalizeEditorDirectiveRecords(parsedDirectives, definitions);
	const draft: DirectiveDerivedStateDraft = {
		sourceCode: code,
		blockState: {
			disabled: false,
			isHome: false,
			isFavorite: false,
		},
		displayState: {},
		displayModel: buildDisplayModel(code),
		addVerticalSpaceAfterSourceLine: createVerticalSpaceAfterSourceLineAdder(),
		layoutCallbacks: [],
		state: options.state,
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
		addVerticalSpaceAfterSourceLine: draft.addVerticalSpaceAfterSourceLine,
		layoutCallbacks: draft.layoutCallbacks,
	};
}

export function runBlockLayoutReady(
	graphicData: CodeBlockGraphicData,
	state: State,
	directiveState: DirectiveDerivedState
): void {
	directiveState.layoutCallbacks.forEach(callbacks => {
		callbacks.onBlockLayoutReady?.(graphicData, state, directiveState);
	});
}

export function runBeforeGraphicDataWidthCalculation(
	graphicData: CodeBlockGraphicData,
	state: State,
	directiveState: DirectiveDerivedState,
	definitions: EditorDirectiveDefinition[] = directiveDefinitions
): void {
	delete graphicData.minGridWidth;
	definitions.forEach(definition => {
		definition.clearDerivedBlockData?.(graphicData);
	});

	directiveState.layoutCallbacks.forEach(callbacks => {
		callbacks.beforeGraphicDataWidthCalculation?.(graphicData, state, directiveState);
	});
}
