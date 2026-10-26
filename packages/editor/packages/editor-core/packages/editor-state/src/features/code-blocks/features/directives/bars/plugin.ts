import { createDirectiveDefinition } from '../utils';
import { createBarsDirectiveData } from './data';
import { createBarsDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
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
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.arrayBars = [];
		},
	}
);
