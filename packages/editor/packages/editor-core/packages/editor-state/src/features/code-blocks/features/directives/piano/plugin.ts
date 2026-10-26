import { createDirectivePlugin } from '../utils';
import { createPianoDirectiveData } from './data';
import { createPianoDirectiveLayoutCallbacks } from './resolve';

export default createDirectivePlugin(
	'piano',
	(directive, draft) => {
		const piano = createPianoDirectiveData(directive.args, directive.rawRow);
		if (!piano) {
			return;
		}

		draft.layoutContributions.push({ rawRow: directive.rawRow, rows: 6 });
		draft.layoutCallbacks.push(createPianoDirectiveLayoutCallbacks(piano));
	},
	{
		clearGraphicData: graphicData => {
			graphicData.widgets.pianoKeyboards = [];
			delete graphicData.minGridWidth;
		},
	}
);
