import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';

export default function getCodeBlockErrors(state: State, codeBlock: CodeBlockGraphicData) {
	const projectScopePath = codeBlock.isProjectScope
		? codeBlock.projectPath
		: codeBlock.childProject
			? createChildProjectGroupPath(codeBlock.projectPath, codeBlock.name)
			: undefined;
	return Object.values(state.codeErrors)
		.flat()
		.filter(
			error =>
				error.codeBlockId === codeBlock.creationIndex ||
				(projectScopePath !== undefined && error.projectGroupPath === projectScopePath)
		);
}
