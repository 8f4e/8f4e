import { createDirectivePlugin } from '../utils';
import { createCrossfadeDirectiveData } from './data';
import { createCrossfadeDirectiveLayoutCallbacks } from './resolve';

export default createDirectivePlugin(
	'crossfade',
	(directive, draft) => {
		const crossfade = createCrossfadeDirectiveData(directive.args, directive.rawRow);
		if (!crossfade) {
			return;
		}

		draft.layoutContributions.push({ rawRow: directive.rawRow, rows: 2 });
		draft.layoutCallbacks.push(createCrossfadeDirectiveLayoutCallbacks(crossfade));
	},
	{
		clearGraphicData: graphicData => {
			graphicData.widgets.crossfades = [];
		},
	}
);
