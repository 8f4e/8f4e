import { createDirectiveDefinition } from '../utils';
import { createPianoDirectiveData } from './data';
import { createPianoDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'piano',
	(directive, draft) => {
		const piano = createPianoDirectiveData(directive.args, directive.sourceLineIndex);
		if (!piano) {
			return;
		}

		draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 6 });
		draft.layoutCallbacks.push(createPianoDirectiveLayoutCallbacks(piano));
	},
	{
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.pianoKeyboards = [];
			delete graphicData.minGridWidth;
		},
	}
);
