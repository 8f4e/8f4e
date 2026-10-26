import { createDirectiveDefinition } from '../utils';
import { createStackDirectiveLayoutCallbacks } from './resolve';

export default createDirectiveDefinition(
	'stack',
	(directive, draft) => {
		if (directive.args.length > 0) {
			return;
		}

		draft.layoutCallbacks.push(
			createStackDirectiveLayoutCallbacks({
				lineNumber: directive.sourceLineIndex,
				isTrailing: !/^\s*;/.test(directive.sourceLine ?? ''),
			})
		);
	},
	{ aliases: ['s'], allowTrailingComment: true }
);
