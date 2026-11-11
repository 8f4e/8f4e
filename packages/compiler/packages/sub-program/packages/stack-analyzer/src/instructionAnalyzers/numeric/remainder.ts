import { getError } from '@8f4e/compiler-diagnostics';
import type { CompilationContext, CompilerASTLine } from '@8f4e/language-spec';
import { ErrorCode } from '@8f4e/language-spec';
import { deriveKnownIntegerValue } from '../../utils/knownIntegerValue';
import { consume, produce } from '../stack';
import type { InstructionAnalysisResult } from '../types';
import { knownIntegerResult } from './shared';

/**
 * Analyzes `remainder` stack effects, known integer propagation, and zero-divisor failures.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Stack-analysis result for the remainder instruction.
 */
export function analyzeRemainder(line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 2);
	const divisor = consumed[1];

	if (!divisor.isNonZero) {
		throw getError(ErrorCode.DIVISION_BY_ZERO, line, { symbol: context.codeBlockId });
	}

	const integerMetadata = deriveKnownIntegerValue(consumed[0], divisor, (dividend, divisorValue) => {
		if (divisorValue === 0) {
			return undefined;
		}

		return (dividend % divisorValue) | 0;
	});
	const produced = [knownIntegerResult(integerMetadata.knownValue)];
	produce(context, produced);
	return { consumed, produced };
}
