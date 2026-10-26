import { createDirectiveDefinition } from '../utils';
import { createWatchDirectiveData } from './data';
import { createWatchDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'watch',
	(directive, draft) => {
		const watch = createWatchDirectiveData(directive.args, directive.rawRow, directive.sourceLine);
		if (!watch) {
			return;
		}

		draft.layoutCallbacks.push(createWatchDirectiveLayoutCallbacks(watch));
	},
	{
		aliases: ['w'],
		allowTrailingComment: true,
		clearDerivedBlockData: graphicData => {
			graphicData.widgets.debuggers = [];
		},
	}
);
