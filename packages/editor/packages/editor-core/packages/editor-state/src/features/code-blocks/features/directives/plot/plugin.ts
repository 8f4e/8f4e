import { createDirectiveDefinition } from '../utils';
import { createPlotDirectiveData } from './data';
import { createPlotDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'plot',
	(directive, draft) => {
		const plot = createPlotDirectiveData(directive.args, directive.rawRow);
		if (!plot) {
			return;
		}

		draft.layoutContributions.push({ rawRow: directive.rawRow, rows: 8 });
		draft.layoutCallbacks.push(createPlotDirectiveLayoutCallbacks(plot));
	},
	{
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.arrayPlotters = [];
		},
	}
);
