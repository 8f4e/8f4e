import { getError } from '@8f4e/compiler-diagnostics';
import type { CompilationContext, CompilerASTLine, LoopLine } from '@8f4e/language-spec';
import { ErrorCode } from '@8f4e/language-spec';
import { cloneStack, consume } from './stack';
import type { InstructionAnalysisResult } from './types';

/** Consumes a normalized loop bound and checks that it is a scalar integer. */
export function analyzeLoop(line: LoopLine, context: CompilationContext): InstructionAnalysisResult {
	if (!line.runtimeBound) return { consumed: [], produced: [] };

	const consumed = consume(context, 1);
	const [bound] = consumed;
	if (bound?.kind !== 'value' || bound.valueType !== 'int') {
		throw getError(ErrorCode.TYPE_MISMATCH, line, { symbol: context.codeBlockId });
	}
	return { consumed, produced: [] };
}

/**
 * Consumes an exit condition and marks the remaining stack as dropped for the conditional branch.
 *
 * @param _line - Compiler line kept for the shared analyzer signature.
 * @param context - Compilation context used by the operation.
 * @returns The stack-analysis result for the instruction.
 */
export function analyzeExitIfTrue(_line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 1);
	return { consumed, produced: [], dropped: cloneStack(context.stack) };
}
