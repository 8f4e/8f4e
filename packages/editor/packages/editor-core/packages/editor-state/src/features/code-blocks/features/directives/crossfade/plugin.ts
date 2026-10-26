import { createDirectiveDefinition } from '../utils';
import { createCrossfadeDirectiveData } from './data';
import { createCrossfadeDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
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
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.crossfades = [];
		},
	}
);
