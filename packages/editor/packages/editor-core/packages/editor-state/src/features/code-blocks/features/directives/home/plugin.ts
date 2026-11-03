import { parseViewportBlockAlignment } from '../../../../viewport/blockAlignment';
import { createDirectiveDefinition } from '../utils';

export default createDirectiveDefinition('home', (directive, draft) => {
	if (directive.args.length > 1) {
		return;
	}

	const alignment = parseViewportBlockAlignment(directive.args[0]);
	if (alignment === undefined) {
		return;
	}

	draft.blockState.isHome = true;
	draft.blockState.homeAlignment = alignment;
});
