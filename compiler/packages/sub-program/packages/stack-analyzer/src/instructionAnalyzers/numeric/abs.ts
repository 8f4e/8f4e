import type { CompilationContext, CompilerASTLine, Stack } from '@8f4e/language-spec';
import { consume, createStackValue, produce } from '../stack';
import type { InstructionAnalysisResult } from '../types';

/**
 * Analyzes `abs` stack effects and known-value propagation.
 *
 * @param _line - Unused source AST line kept for handler signature consistency.
 * @param context - Compilation context used by the operation.
 * @returns Stack-analysis result for the abs instruction.
 */
export function analyzeAbs(_line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 1);
	const operand = consumed[0];
	const knownAbsValue =
		operand.knownValue === undefined
			? undefined
			: operand.valueType === 'int'
				? operand.knownValue < 0
					? (0 - operand.knownValue) | 0
					: operand.knownValue
				: Math.abs(operand.knownValue);
	const runtimeKnownValue =
		operand.valueType === 'float' && knownAbsValue !== undefined ? Math.fround(knownAbsValue) : knownAbsValue;
	const produced: Stack = [
		createStackValue(operand.valueType, {
			isNonZero: runtimeKnownValue !== undefined ? runtimeKnownValue !== 0 : operand.isNonZero,
			knownValue: runtimeKnownValue,
		}),
	];
	produce(context, produced);
	return { consumed, produced };
}
