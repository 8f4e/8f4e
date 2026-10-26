import { createDirectivePlugin } from '../utils';
import { createSliderDirectiveData } from './data';
import { createSliderDirectiveLayoutCallbacks } from './resolve';

export default createDirectivePlugin(
	'slider',
	(directive, draft) => {
		const slider = createSliderDirectiveData(directive.args, directive.rawRow);
		if (!slider) {
			return;
		}

		draft.layoutContributions.push({ rawRow: directive.rawRow, rows: 2 });
		draft.layoutCallbacks.push(createSliderDirectiveLayoutCallbacks(slider));
	},
	{
		clearGraphicData: graphicData => {
			graphicData.widgets.sliders = [];
		},
	}
);
