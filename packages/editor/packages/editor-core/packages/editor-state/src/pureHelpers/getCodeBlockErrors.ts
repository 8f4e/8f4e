import type { CodeBlockGraphicData, CodeError, ProjectLevel, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';
import { walkProjectBlocks } from './projectTree';

function getProjectScopePath(codeBlock: CodeBlockGraphicData) {
	return codeBlock.isProjectScope
		? codeBlock.projectPath
		: codeBlock.childProject
			? createChildProjectGroupPath(codeBlock.projectPath, codeBlock.name)
			: undefined;
}

export default function getCodeBlockErrors(state: State, codeBlock: CodeBlockGraphicData) {
	const projectScopePath = getProjectScopePath(codeBlock);
	return Object.values(state.codeErrors)
		.flat()
		.filter(
			error =>
				error.codeBlockId === codeBlock.creationIndex ||
				(projectScopePath !== undefined && error.projectGroupPath === projectScopePath)
		);
}

/** Index the current tree once, retaining the first block matching either identity or project scope. */
export function createCodeErrorBlockLookup(project: ProjectLevel) {
	type Entry = { codeBlock: CodeBlockGraphicData; order: number };
	const blocksById = new Map<number, Entry>();
	const blocksByScope = new Map<string, Entry>();
	let order = 0;
	for (const codeBlock of walkProjectBlocks(project)) {
		const entry = { codeBlock, order: order++ };
		blocksById.set(codeBlock.creationIndex, entry);
		const scope = getProjectScopePath(codeBlock);
		if (scope !== undefined && !blocksByScope.has(scope)) blocksByScope.set(scope, entry);
	}
	return (error: CodeError): CodeBlockGraphicData | undefined => {
		const document = blocksById.get(error.codeBlockId);
		const scope = error.projectGroupPath === undefined ? undefined : blocksByScope.get(error.projectGroupPath);
		if (!document) return scope?.codeBlock;
		return scope && scope.order < document.order ? scope.codeBlock : document.codeBlock;
	};
}
