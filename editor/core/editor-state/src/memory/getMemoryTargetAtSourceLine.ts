import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';
import {
	ArgumentType,
	isMemoryDeclarationLine,
	isReferenceSlotLine,
	type MemoryDeclarationLine,
} from '@8f4e/language-spec';
import { getCompiledModuleForCodeBlock } from '../compiler-metadata/getCompiledModuleForCodeBlock';
import resolveMemoryTarget, { type ResolvedMemoryTarget } from './resolveMemoryTarget';

function getDeclarationName(line: MemoryDeclarationLine): string | undefined {
	const firstArg = line.arguments[0];
	return firstArg?.type === ArgumentType.IDENTIFIER && firstArg.referenceKind === 'plain' ? firstArg.value : undefined;
}

/**
 * Resolves an allocated declaration or fixed reference on the current source row when compiled.
 * Returns undefined when the row has no memory declaration. A result with target: undefined marks a declaration
 * whose matching accepted metadata is not yet available, allowing consumers to reserve its layout space.
 */
export default function getMemoryTargetAtSourceLine(
	state: State,
	codeBlock: EditorCodeBlock,
	sourceLineIndex: number
): { target: ResolvedMemoryTarget | undefined } | undefined {
	if (codeBlock.blockType !== 'module') return;

	const sourcePreparation = codeBlock.sourcePreparation;
	const instructionLineNumber = sourcePreparation.instructionLineBySourceLine[sourceLineIndex];
	if (instructionLineNumber === undefined) return;
	const compiledModule = getCompiledModuleForCodeBlock(codeBlock, state);
	const currentCompiledLine =
		state.compiler.result.inputRevision === state.compilerInputRevision
			? compiledModule?.ast.lines.find(line => line.lineNumber === instructionLineNumber)
			: undefined;
	const sourceLine =
		currentCompiledLine ?? sourcePreparation.parsedMemoryLineBySourceLine[sourceLineIndex];
	if (!sourceLine) return;
	if (!isMemoryDeclarationLine(sourceLine) && !isReferenceSlotLine(sourceLine)) return;
	if (!compiledModule) return { target: undefined };
	if (isReferenceSlotLine(sourceLine)) {
		const name = sourceLine.arguments[0];
		const target =
			name?.type === ArgumentType.IDENTIFIER && name.referenceKind === 'plain'
				? resolveMemoryTarget(state, { kind: 'module', moduleId: compiledModule.id }, name.value)
				: undefined;
		return {
			target:
				target?.reference?.lineNumber === instructionLineNumber && target.reference.type === sourceLine.instruction
					? target
					: undefined,
		};
	}
	const plannedModule = state.compiler.result.memoryPlan.modules[compiledModule.id];
	if (!plannedModule) return { target: undefined };

	const sourceName = getDeclarationName(sourceLine);
	const memory = plannedModule.declarations.find(
		({ source }) =>
			source.lineNumber === instructionLineNumber &&
			source.instruction === sourceLine.instruction &&
			getDeclarationName(source) === sourceName
	);
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
