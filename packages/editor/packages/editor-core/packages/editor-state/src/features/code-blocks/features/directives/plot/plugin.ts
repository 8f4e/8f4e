import { createDirectivePlugin } from '../utils';
import { createPlotDirectiveData } from './data';
import { createPlotDirectiveLayoutCallbacks } from './resolve';

export default createDirectivePlugin(
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
		clearGraphicData: graphicData => {
			graphicData.widgets.arrayPlotters = [];
		},
	}
);
