import { getError } from '@8f4e/compiler-diagnostics';
import type { CompilationContext, CompilerASTLine } from '@8f4e/language-spec';
import { BASE_TYPE_METADATA, ErrorCode } from '@8f4e/language-spec';
import { deriveKnownIntegerValue } from '../../utils/knownIntegerValue';
import { consume, produce } from '../stack';
import type { InstructionAnalysisResult } from '../types';
import { numericResult } from './shared';

/**
 * Analyzes `div` stack effects, known-value propagation, and zero-divisor failures.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Stack-analysis result for the div instruction.
 */
export function analyzeDiv(line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 2);
	const right = consumed[1];

	if (!right.isNonZero) {
		throw getError(ErrorCode.DIVISION_BY_ZERO, line, context);
	}

	const produced = [
		numericResult(consumed[0], right, {
			calculateKnownValue: (dividend, divisor) => dividend / divisor,
			deriveIntegerMetadata: (left, divisor) =>
				deriveKnownIntegerValue(left, divisor, (dividend, divisorValue) => {
					if (dividend === BASE_TYPE_METADATA.int.min && divisorValue === -1) {
						return undefined;
					}

					return Math.trunc(dividend / divisorValue) | 0;
				}),
		}),
	];
	produce(context, produced);
	return { consumed, produced };
}
