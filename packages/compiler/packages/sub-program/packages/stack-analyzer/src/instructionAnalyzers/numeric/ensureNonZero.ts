import type { CompilationContext, EnsureNonZeroLine } from '@8f4e/language-spec';
import { consume, createStackValue, produce } from '../stack';
import type { InstructionAnalysisResult } from '../types';

/** Derives nonzero facts from the input and the fallback's actual runtime representation. */
export function analyzeEnsureNonZero(line: EnsureNonZeroLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 1);
	const operand = consumed[0];
	const fallback = line.arguments[0]?.value ?? 1;
	const runtimeFallback =
		operand.valueType === 'int' ? fallback | 0 : operand.valueType === 'float' ? Math.fround(fallback) : fallback;
	const produced = [
		createStackValue(operand.valueType, {
			isNonZero: !!operand.isNonZero || runtimeFallback !== 0,
		}),
	];
	produce(context, produced);
	return { consumed, produced };
}
