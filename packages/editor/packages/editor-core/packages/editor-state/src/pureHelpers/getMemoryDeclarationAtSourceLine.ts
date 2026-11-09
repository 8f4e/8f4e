import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import {
	ArgumentType,
	type CompilerASTLine,
	isMemoryDeclarationLine,
	type MemoryDeclarationLine,
	type PlannedMemoryDeclaration,
} from '@8f4e/language-spec';
import { parseLine } from '@8f4e/tokenizer';
import { getCompiledModuleForCodeBlock } from '../features/code-blocks/utils/getCompiledModuleForCodeBlock';

function getDeclarationName(line: MemoryDeclarationLine): string | undefined {
	const firstArg = line.arguments[0];
	return firstArg?.type === ArgumentType.IDENTIFIER && firstArg.referenceKind === 'plain' ? firstArg.value : undefined;
}

/** Checks for a declaration on the source row and returns its memory when compiled. */
export default function getMemoryDeclarationAtSourceLine(
	state: State,
	codeBlock: CodeBlockGraphicData,
	sourceLineIndex: number
): { memory: PlannedMemoryDeclaration | undefined } | undefined {
	if (codeBlock.blockType !== 'module') return;

	// Source edits can refresh layout while the previous compilation is still active.
	let sourceLine: CompilerASTLine;
	try {
		sourceLine = parseLine(codeBlock.code[sourceLineIndex], sourceLineIndex);
	} catch {
		return;
	}
	if (!isMemoryDeclarationLine(sourceLine)) return;
	const compiledModule = getCompiledModuleForCodeBlock(codeBlock, state);
	const plannedModule = compiledModule && state.compiler.result.memoryPlan.modules[compiledModule.id];
	if (!plannedModule) return { memory: undefined };

	const sourceName = getDeclarationName(sourceLine);
	const index = plannedModule.declarationSources.findIndex(
		({ line, isInherited }) =>
			!isInherited &&
			line.lineNumber === sourceLineIndex &&
			line.instruction === sourceLine.instruction &&
			getDeclarationName(line) === sourceName
	);
	return { memory: plannedModule.declarations[index] };
}
