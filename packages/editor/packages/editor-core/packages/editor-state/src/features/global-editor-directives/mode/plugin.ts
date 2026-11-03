import { createGlobalEditorDirectiveDefinition } from '../utils';

export default createGlobalEditorDirectiveDefinition('mode', (directive, draft, context) => {
	// Keep the property present even after invalidation so later declarations cannot restore a duplicate.
	const duplicate = Object.hasOwn(draft.resolved, 'mode');
	draft.resolved.mode = undefined;
	if (duplicate) {
		draft.errors.push({
			lineNumber: directive.sourceLineIndex,
			message: '@mode may be declared only once per project',
			codeBlockId: context.codeBlockId,
		});
		return;
	}
	const [mode] = directive.args;
	if (directive.args.length !== 1 || (mode !== 'edit' && mode !== 'view')) {
		draft.errors.push({
			lineNumber: directive.sourceLineIndex,
			message: '@mode requires exactly 1 argument: edit or view',
			codeBlockId: context.codeBlockId,
		});
		return;
	}
	draft.resolved.mode = mode;
});
