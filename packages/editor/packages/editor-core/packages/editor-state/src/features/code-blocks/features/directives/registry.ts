import type {
	CodeBlockGraphicData,
	DirectiveDerivedState,
	DirectiveDerivedStateDraft,
	DirectiveDeriveOptions,
	EditorDirectivePlugin,
	EditorDirectiveRegistry,
	ParsedDirectiveRecord,
	State,
} from '@8f4e/editor-state-types';
import buildDisplayModel from '../../buildDisplayModel';
import alwaysOnTopDirective from './alwaysOnTop/plugin';
import barsDirective from './bars/plugin';
import buttonDirective from './button/plugin';
import crossfadeDirective from './crossfade/plugin';
import disabledDirective from './disabled/plugin';
import favoriteDirective from './favorite/plugin';
import groupDirective from './group/plugin';
import hideDirective from './hide/plugin';
import homeDirective from './home/plugin';
import infoDirective from './info/plugin';
import meterDirective from './meter/plugin';
import pianoDirective from './piano/plugin';
import plotDirective from './plot/plugin';
import sliderDirective from './slider/plugin';
import stackDirective from './stack/plugin';
import { normalizeEditorDirectiveRecords } from './utils';
import viewportDirective from './viewport/plugin';
import watchDirective from './watch/plugin';
import waveDirective, { wave2Directive, wave4Directive } from './wave/plugin';

export type {
	DirectiveBlockState,
	DirectiveDerivedState,
	DirectiveLayoutContribution,
	ParsedEditorDirective,
	ViewportAnchor,
} from '@8f4e/editor-state-types';

export const directivePlugins: EditorDirectivePlugin[] = [
	meterDirective,
	barsDirective,
	plotDirective,
	waveDirective,
	wave2Directive,
	wave4Directive,
	sliderDirective,
	crossfadeDirective,
	pianoDirective,
	buttonDirective,
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

export function createDirectiveRegistry(): EditorDirectiveRegistry & { plugins: EditorDirectivePlugin[] } {
	const plugins = [...directivePlugins];
	return {
		plugins,
		register: directive => {
			plugins.push(directive);
			return () => {
				const index = plugins.indexOf(directive);
				if (index !== -1) plugins.splice(index, 1);
			};
		},
	};
}

export function deriveDirectiveState(
	code: string[],
	parsedDirectives: ParsedDirectiveRecord[],
	options: DirectiveDeriveOptions = {},
	plugins: EditorDirectivePlugin[] = directivePlugins
): DirectiveDerivedState {
	const directives = normalizeEditorDirectiveRecords(parsedDirectives, plugins);
	const draft: DirectiveDerivedStateDraft = {
		sourceCode: code,
		blockState: {
			disabled: false,
			isHome: false,
			isFavorite: false,
		},
		displayState: {},
		displayModel: buildDisplayModel(code),
		layoutContributions: [],
		widgets: [],
		state: options.state,
	};

	for (const directive of directives) {
		const plugin = plugins.find(candidate => candidate.name === directive.name);
		plugin?.apply?.(directive, draft);
	}

	return {
		blockState: draft.blockState,
		displayState: draft.displayState,
		displayModel: buildDisplayModel(code, {
			...draft.displayState,
			isExpandedForEditing: options.isExpandedForEditing,
		}),
		layoutContributions: draft.layoutContributions,
		widgets: draft.widgets,
	};
}

export function runBlockLayoutReady(
	graphicData: CodeBlockGraphicData,
	state: State,
	directiveState: DirectiveDerivedState
): void {
	directiveState.widgets.forEach(widget => {
		widget.onBlockLayoutReady?.(graphicData, state, directiveState);
	});
}

export function runBeforeGraphicDataWidthCalculation(
	graphicData: CodeBlockGraphicData,
	state: State,
	directiveState: DirectiveDerivedState,
	plugins: EditorDirectivePlugin[] = directivePlugins
): void {
	plugins.forEach(plugin => {
		plugin.clearGraphicData?.(graphicData);
	});

	directiveState.widgets.forEach(widget => {
		widget.beforeGraphicDataWidthCalculation?.(graphicData, state, directiveState);
	});
}
