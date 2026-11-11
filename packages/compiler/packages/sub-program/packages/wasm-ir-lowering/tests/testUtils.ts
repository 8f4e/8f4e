import { WASM_IF } from '@8f4e/compiler-wasm-utils';
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
 * Asserts the lowered instructions for guarded memory dereferences.
 *
 * @param instructions - Lowered instructions to inspect.
 * @param options - Expected prefix, final load sequence, guard count, and result type.
 * @returns Nothing.
 */
export function expectGuardedDereference(
	instructions: readonly WasmIRInstruction[],
	options: { prefix: WasmIRInstruction[]; finalLoad: WasmIRInstruction[]; guardCount: number; resultType: number }
): void {
	expect(instructions.slice(0, options.prefix.length)).toEqual(options.prefix);
	expect(instructions).toContainEqual({ kind: 'memory.size' });
	expect(instructions).toEqual(expect.arrayContaining(options.finalLoad));
	expect(
		instructions.filter(
			op =>
				typeof op !== 'number' && op.kind === 'block' && op.opcode === WASM_IF && op.results[0] === options.resultType
		)
	).toHaveLength(options.guardCount);
}
