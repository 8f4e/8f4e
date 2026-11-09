import { getModuleCompilationForCodeBlock } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { getMemoryDeclarationRows } from './getMemoryDeclarationRows';

export function getShapeDeclarations(codeBlock: CodeBlockGraphicData, state: State) {
	if (codeBlock.disabled || codeBlock.blockType !== 'module') return [];
	const compilation = getModuleCompilationForCodeBlock(codeBlock, state);
	if (!compilation) return [];
	return getMemoryDeclarationRows(compilation.plannedModule, compilation.memoryDefaults)
		.filter(({ rowOffset }) => rowOffset > 0)
		.map(({ memory, rowOffset }) => ({
			sourceLineIndex: memory.lineNumber,
			rowOffset,
			text: memory.name === undefined ? memory.type : `${memory.type} ${memory.name}`,
		}));
}
