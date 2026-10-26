import type { CodeBlockGraphicData, EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { createSliderDirectiveData } from '../helpers/data';
import type { Slider } from '../types';
import { createSliderDirectiveLayoutCallbacks } from './layout';

export function createSliderDirective(
	slidersByBlock: WeakMap<CodeBlockGraphicData, Slider[]>
): EditorDirectiveDefinition {
	return {
		name: 'slider',
		clearDerivedBlockData: codeBlock => {
			slidersByBlock.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createSliderDirectiveData(directive.args, directive.sourceLineIndex);
			if (!data) return;
			draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 2 });
			draft.layoutCallbacks.push(createSliderDirectiveLayoutCallbacks(data, slidersByBlock));
		},
	};
}
