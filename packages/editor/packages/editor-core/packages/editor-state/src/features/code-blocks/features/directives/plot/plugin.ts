import { createDirectiveDefinition } from '../utils';
import { createPlotDirectiveData } from './data';
import { createPlotDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'plot',
	(directive, draft) => {
		const plot = createPlotDirectiveData(directive.args, directive.sourceLineIndex);
		if (!plot) {
			return;
		}

		draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 8 });
		draft.layoutCallbacks.push(createPlotDirectiveLayoutCallbacks(plot));
	},
	{
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.arrayPlotters = [];
		},
	}
);
