import { WASM_IF, WASM_MEMORY_SIZE } from '@8f4e/compiler-wasm-utils';
import type {
	CodegenContext,
	CompilerASTLine,
	InstructionCompiler,
	MemoryPointerIdentifier,
	Stack,
	StackAnalysisLineFacts,
	WasmIRInstruction,
} from '@8f4e/language-spec';
import { ArgumentType, BlockType } from '@8f4e/language-spec';
import { expect } from 'vitest';
import { createCodegenContext } from '../src/createCodegenContext';
export default function createInstructionCompilerTestContext(overrides: Partial<CodegenContext> = {}): CodegenContext {
	return createCodegenContext({
		...overrides,
		blockStack: overrides.blockStack ?? [{ blockType: BlockType.MODULE, expectedResultTypes: [] }],
		codeBlockId: overrides.codeBlockId ?? 'test',
		codeBlockType: overrides.codeBlockType ?? 'module',
	});
}

export function identifier(value: string) {
	return { type: ArgumentType.IDENTIFIER, value, referenceKind: 'plain', scope: 'local' } as const;
}

export function pointerIdentifier(targetMemoryId: string, dereferenceDepth: number): MemoryPointerIdentifier {
	return {
		...identifier(`${'*'.repeat(dereferenceDepth)}${targetMemoryId}`),
		referenceKind: 'memory-pointer',
		targetMemoryId,
		dereferenceDepth,
	};
}

/** Builds resolved facts for tests without running or duplicating stack analysis. */
export function createStackFacts({
	consumedOperands = [],
	droppedStackItems,
	...facts
}: Partial<Omit<StackAnalysisLineFacts, 'stackAnalysis'>> & {
	consumedOperands?: Stack;
	droppedStackItems?: Stack;
} = {}): StackAnalysisLineFacts {
	return {
		...facts,
		stackAnalysis: {
			stackBefore: [],
			stackAfter: [],
			consumedOperands,
			producedStackItems: [],
			...(droppedStackItems ? { droppedStackItems } : {}),
		},
	};
}

export function compileInstructionForTest<TLine extends CompilerASTLine>(
	compileInstruction: InstructionCompiler<TLine>,
	line: TLine,
	context: CodegenContext,
	facts: StackAnalysisLineFacts = createStackFacts()
): CodegenContext {
	compileInstruction(line, context, facts);
	return context;
}

/**
 * Counts occurrences of a fixed Wasm byte sequence in lowered instructions.
 *
 * @param haystack - Bytecode sequence to search.
 * @param needle - Bytecode subsequence to count.
 * @returns The number of matching subsequences.
 */
export function countByteCodeSequence(haystack: readonly WasmIRInstruction[], needle: readonly number[]): number {
	let count = 0;
	for (let i = 0; i <= haystack.length - needle.length; i++) {
		if (needle.every((value, index) => haystack[i + index] === value)) {
			count++;
		}
	}
	return count;
}

/**
 * Checks for a fixed Wasm byte sequence in lowered instructions.
 *
 * @param haystack - Bytecode sequence to search.
 * @param needle - Bytecode subsequence to find.
 * @returns True when the subsequence occurs at least once.
 */
export function containsByteCodeSequence(haystack: readonly WasmIRInstruction[], needle: readonly number[]): boolean {
	return countByteCodeSequence(haystack, needle) > 0;
}

/**
 * Asserts the lowered instructions for guarded memory dereferences.
 *
 * @param instructions - Lowered instructions to inspect.
 * @param options - Expected prefix, final load sequence, guard count, and result type.
 * @returns Nothing.
 */
export function expectGuardedDereference(
	instructions: readonly WasmIRInstruction[],
	options: { prefix: WasmIRInstruction[]; finalLoad: number[]; guardCount: number; resultType: number }
): void {
	expect(instructions.slice(0, options.prefix.length)).toEqual(options.prefix);
	expect(instructions).toContain(WASM_MEMORY_SIZE);
	expect(containsByteCodeSequence(instructions, options.finalLoad)).toBe(true);
	expect(countByteCodeSequence(instructions, [WASM_IF, options.resultType])).toBe(options.guardCount);
}
