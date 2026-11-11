import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import {
	ArgumentType,
	type CompilerASTLine,
	isMemoryDeclarationLine,
	isReferenceSlotLine,
	type MemoryDeclarationLine,
} from '@8f4e/language-spec';
import { parseLine } from '@8f4e/tokenizer';
import { getCompiledModuleForCodeBlock } from '../features/code-blocks/utils/getCompiledModuleForCodeBlock';
import resolveMemoryTarget, { type ResolvedMemoryTarget } from './resolveMemoryTarget';

function getDeclarationName(line: MemoryDeclarationLine): string | undefined {
	const firstArg = line.arguments[0];
	return firstArg?.type === ArgumentType.IDENTIFIER && firstArg.referenceKind === 'plain' ? firstArg.value : undefined;
}

/** Resolves an allocated declaration or fixed reference on the current source row when compiled. */
export default function getMemoryTargetAtSourceLine(
	state: State,
	codeBlock: CodeBlockGraphicData,
	sourceLineIndex: number
): { target: ResolvedMemoryTarget | undefined } | undefined {
	if (codeBlock.blockType !== 'module') return;

	// Source edits can refresh layout while the previous compilation is still active.
	let sourceLine: CompilerASTLine;
	try {
		sourceLine = parseLine(codeBlock.code[sourceLineIndex], sourceLineIndex);
	} catch {
		return;
	}
	if (!isMemoryDeclarationLine(sourceLine) && !isReferenceSlotLine(sourceLine)) return;
	const compiledModule = getCompiledModuleForCodeBlock(codeBlock, state);
	if (!compiledModule) return { target: undefined };
	if (isReferenceSlotLine(sourceLine)) {
		const name = sourceLine.arguments[0];
		const target =
			name?.type === ArgumentType.IDENTIFIER && name.referenceKind === 'plain'
				? resolveMemoryTarget(state, { kind: 'module', moduleId: compiledModule.id }, name.value)
				: undefined;
		return {
			target:
				target?.reference?.lineNumber === sourceLineIndex && target.reference.type === sourceLine.instruction
					? target
					: undefined,
		};
	}
	const plannedModule = state.compiler.result.memoryPlan.modules[compiledModule.id];
	if (!plannedModule) return { target: undefined };

	const sourceName = getDeclarationName(sourceLine);
	const index = plannedModule.declarationSources.findIndex(
		({ line, isInherited }) =>
			!isInherited &&
			line.lineNumber === sourceLineIndex &&
			line.instruction === sourceLine.instruction &&
			getDeclarationName(line) === sourceName
	);
	const memory = plannedModule.declarations[index];
	return {
		target: memory
			? {
					publicModuleId: compiledModule.id,
					publicName: memory.name,
					moduleId: compiledModule.id,
					memory,
				}
			: undefined,
	};
}
