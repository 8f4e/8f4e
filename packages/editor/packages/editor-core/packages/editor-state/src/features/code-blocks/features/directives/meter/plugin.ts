import { createDirectivePlugin } from '../utils';
import { createMeterDirectiveData } from './data';
import { createMeterDirectiveLayoutCallbacks } from './resolve';

export default createDirectivePlugin(
	'meter',
	(directive, draft) => {
		const meter = createMeterDirectiveData(directive.args, directive.rawRow, directive.sourceLine);
		if (!meter) {
			return;
		}

		draft.layoutContributions.push({ rawRow: directive.rawRow, rows: 1 });
		draft.layoutCallbacks.push(createMeterDirectiveLayoutCallbacks(meter));
	},
	{
		allowTrailingComment: true,
		clearGraphicData: graphicData => {
			graphicData.widgets.arrayMeters = [];
		},
	}
);
