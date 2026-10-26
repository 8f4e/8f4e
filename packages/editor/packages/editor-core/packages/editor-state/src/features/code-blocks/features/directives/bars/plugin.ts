import { createDirectivePlugin } from '../utils';
import { createBarsDirectiveData } from './data';
import { createBarsDirectiveLayoutCallbacks } from './resolve';

export default createDirectivePlugin(
	'bars',
	(directive, draft) => {
		const bars = createBarsDirectiveData(directive.args, directive.rawRow);
		if (!bars) {
			return;
		}

		draft.layoutContributions.push({ rawRow: directive.rawRow, rows: 8 });
		draft.layoutCallbacks.push(createBarsDirectiveLayoutCallbacks(bars));
	},
	{
		clearGraphicData: graphicData => {
			graphicData.widgets.arrayBars = [];
		},
	}
);
