import { createDirectiveDefinition } from '../utils';
import { createMeterDirectiveData } from './data';
import { createMeterDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'meter',
	(directive, draft) => {
		const meter = createMeterDirectiveData(directive.args, directive.sourceLineIndex, directive.sourceLine);
		if (!meter) {
			return;
		}

		draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 1 });
		draft.layoutCallbacks.push(createMeterDirectiveLayoutCallbacks(meter));
	},
	{
		allowTrailingComment: true,
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.arrayMeters = [];
		},
	}
);
