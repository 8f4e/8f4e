import type { StackAnalysisNumericValueKind, StackValueType } from '@8f4e/language-spec';

/**
 * Resolves map value metadata to the scalar kind recorded in stack-analysis facts.
 *
 * @param valueKind - Map or stack value metadata to resolve.
 * @returns The computed result.
 */
export function resolveMapKind(valueKind: { valueType: StackValueType }): StackAnalysisNumericValueKind {
	if (valueKind.valueType === 'int') {
		return 'int32';
	}

	return valueKind.valueType === 'float64' ? 'float64' : 'float32';
}
