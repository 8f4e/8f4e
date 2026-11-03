import { WASM_IF, WASM_MEMORY_SIZE } from '@8f4e/compiler-wasm-utils';
import type {
	CodegenContext,
	CompilerASTLine,
	InstructionCompiler,
	Stack,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import { expect } from 'vitest';
import { createCodegenContext } from '../src/createCodegenContext';

export default function createInstructionCompilerTestContext(overrides: Partial<CodegenContext> = {}): CodegenContext {
	return createCodegenContext({
		functionLayout: {
			imports: [],
			functions: {},
			assertionCallbacks: new Map(),
			initDefaultsIndex: 0,
			moduleFunctionIndices: {},
		},
		...overrides,
		nextLocalIndex:
			overrides.nextLocalIndex ??
			Object.values(overrides.locals ?? {}).reduce((next, local) => Math.max(next, local.index + 1), 0),
		blockStack: overrides.blockStack ?? [{ blockType: BlockType.MODULE, expectedResultTypes: [] }],
		codeBlockId: overrides.codeBlockId ?? 'test',
		codeBlockType: overrides.codeBlockType ?? 'module',
	});
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
 * Counts occurrences of one bytecode sequence inside another.
 *
 * @param haystack - Bytecode sequence to search.
 * @param needle - Bytecode subsequence to count.
 * @returns The number of matching subsequences.
 */
export function countByteCodeSequence(haystack: number[], needle: number[]): number {
	let count = 0;
	for (let i = 0; i <= haystack.length - needle.length; i++) {
		if (needle.every((value, index) => haystack[i + index] === value)) {
			count++;
		}
	}
	return count;
}

/**
 * Checks whether one bytecode sequence contains another.
 *
 * @param haystack - Bytecode sequence to search.
 * @param needle - Bytecode subsequence to find.
 * @returns True when the subsequence occurs at least once.
 */
export function containsByteCodeSequence(haystack: number[], needle: number[]): boolean {
	return countByteCodeSequence(haystack, needle) > 0;
}

/**
 * Asserts the bytecode shape emitted for guarded memory dereferences.
 *
 * @param byteCode - Compiled bytecode to inspect.
 * @param options - Expected prefix, final load sequence, guard count, and result type.
 * @returns Nothing.
 */
export function expectGuardedDereference(
	byteCode: number[],
	options: { prefix: number[]; finalLoad: number[]; guardCount: number; resultType: number }
): void {
	expect(byteCode.slice(0, options.prefix.length)).toEqual(options.prefix);
	expect(byteCode).toContain(WASM_MEMORY_SIZE);
	expect(containsByteCodeSequence(byteCode, options.finalLoad)).toBe(true);
	expect(countByteCodeSequence(byteCode, [WASM_IF, options.resultType])).toBe(options.guardCount);
}
