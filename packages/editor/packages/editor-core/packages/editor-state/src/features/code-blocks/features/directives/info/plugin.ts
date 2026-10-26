import { createDirectiveDefinition } from '../utils';
import { createInfoDirectiveData } from './data';
import { getInfoLayout } from './entries';
import { createInfoDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'info',
	(directive, draft) => {
		const info = createInfoDirectiveData(directive.args, directive.rawRow);
		if (!info) {
			return;
		}

		const layout = getInfoLayout(draft.state, info.id);
		draft.layoutCallbacks.push(createInfoDirectiveLayoutCallbacks(info, layout));
		if (layout.rowCount > 0) {
			draft.layoutContributions.push({ rawRow: directive.rawRow, rows: layout.rowCount });
		}
	},
	{
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.infoPanels = [];
		},
	}
);
