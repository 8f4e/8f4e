import { createDirectiveDefinition } from '../utils';
import { createCrossfadeDirectiveData } from './data';
import { createCrossfadeDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'crossfade',
	(directive, draft) => {
		const crossfade = createCrossfadeDirectiveData(directive.args, directive.sourceLineIndex);
		if (!crossfade) {
			return;
		}

		draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 2 });
		draft.layoutCallbacks.push(createCrossfadeDirectiveLayoutCallbacks(crossfade));
	},
	{
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.crossfades = [];
		},
	}
);
