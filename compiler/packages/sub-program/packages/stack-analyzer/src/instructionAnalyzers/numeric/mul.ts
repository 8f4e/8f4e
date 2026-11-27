import type { CompilationContext, CompilerASTLine } from '@8f4e/language-spec';
import { deriveKnownIntegerValue } from '../../utils/knownIntegerValue';
import { consume, produce } from '../stack';
import type { InstructionAnalysisResult } from '../types';
import { numericResult } from './shared';

/**
 * Analyzes `mul` stack effects and known-value propagation.
 *
 * @param _line - Unused source AST line kept for handler signature consistency.
 * @param context - Compilation context used by the operation.
 * @returns Stack-analysis result for the mul instruction.
 */
export function analyzeMul(_line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 2);
	const produced = [
		numericResult(consumed[0], consumed[1], {
			calculateKnownValue: (left, right) => left * right,
			deriveIntegerMetadata: (left, right) =>
				deriveKnownIntegerValue(left, right, (value1, value2) => Math.imul(value1, value2)),
		}),
	];
	produce(context, produced);
	return { consumed, produced };
}
