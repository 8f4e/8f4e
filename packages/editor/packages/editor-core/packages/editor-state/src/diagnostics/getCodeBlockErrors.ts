import type { CodeError, EditorCodeBlock, ProjectLevel, State } from '@8f4e/editor-state-types';
import { walkProjectBlocks } from '../project/tree';

export default function getCodeBlockErrors(state: State, codeBlock: EditorCodeBlock) {
	return Object.values(state.codeErrors)
		.flat()
		.filter(
			(error): error is CodeError & { lineNumber: number } =>
				error.lineNumber !== undefined && error.codeBlockId === codeBlock.creationIndex
		);
}

/** Index the current tree once by code block identity. */
export function createCodeErrorBlockLookup(project: ProjectLevel) {
	const blocksById = new Map([...walkProjectBlocks(project)].map(block => [block.creationIndex, block]));
	return (error: CodeError): EditorCodeBlock | undefined =>
		error.codeBlockId === undefined ? undefined : blocksById.get(error.codeBlockId);
}
