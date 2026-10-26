import { createDirectiveDefinition } from '../utils';
import { createSliderDirectiveData } from './data';
import { createSliderDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'slider',
	(directive, draft) => {
		const slider = createSliderDirectiveData(directive.args, directive.sourceLineIndex);
		if (!slider) {
			return;
		}

		draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 2 });
		draft.layoutCallbacks.push(createSliderDirectiveLayoutCallbacks(slider));
	},
	{
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.sliders = [];
		},
	}
);
