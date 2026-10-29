import { createGlobalEditorDirectiveDefinition } from '../utils';

export default createGlobalEditorDirectiveDefinition('config', (directive, draft, context) => {
	if (directive.args.length !== 2) {
		draft.errors.push({
			lineNumber: directive.sourceLineIndex,
			message: '@config requires exactly 2 arguments: <path> <value>',
			codeBlockId: context.codeBlockId,
		});
		return;
	}

	const [path, value] = directive.args;
	draft.resolved.configEntries = [
		...(draft.resolved.configEntries ?? []),
		{
			path,
			value,
			sourceLineIndex: directive.sourceLineIndex,
			codeBlockId: context.codeBlockId,
			...(context.moduleId ? { moduleId: context.moduleId } : {}),
		},
	];
});
