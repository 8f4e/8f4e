import { createDirectiveDefinition } from '../utils';
import { createBarsDirectiveData } from './data';
import { createBarsDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'bars',
	(directive, draft) => {
		const bars = createBarsDirectiveData(directive.args, directive.sourceLineIndex);
		if (!bars) {
			return;
		}

		draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 8 });
		draft.layoutCallbacks.push(createBarsDirectiveLayoutCallbacks(bars));
	},
	{
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.arrayBars = [];
		},
	}
);
