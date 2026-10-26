import type { ViewportAnchor } from '@8f4e/editor-state-types';
import { createDirectiveDefinition } from '../utils';

const VALID_ANCHORS = new Set<string>(['top-left', 'top-right', 'bottom-left', 'bottom-right']);

export default createDirectiveDefinition('viewport', (directive, draft) => {
	// Only process the first @viewport directive; subsequent ones are ignored.
	if (draft.blockState.viewportAnchor !== undefined) {
		return;
	}

	const [anchor] = directive.args;
	if (!anchor || !VALID_ANCHORS.has(anchor)) {
		return;
	}

	draft.blockState.viewportAnchor = anchor as ViewportAnchor;
});
