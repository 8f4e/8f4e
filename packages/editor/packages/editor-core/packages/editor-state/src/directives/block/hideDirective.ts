import { createDirectiveDefinition } from '../directiveRecords';

export default createDirectiveDefinition('hide', (directive, draft) => {
	if (directive.args.length > 0) {
		return;
	}

	if (draft.displayState.hideAfterSourceLineIndex === undefined) {
		draft.displayState.hideAfterSourceLineIndex = directive.sourceLineIndex;
	}
});
