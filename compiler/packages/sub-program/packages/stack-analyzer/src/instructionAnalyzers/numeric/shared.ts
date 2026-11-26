import type { StackAnalysisNumericValueKind, StackItem, StackValueType } from '@8f4e/language-spec';
import { areAllOperandsFloat64, areAllOperandsIntegers } from '@8f4e/semantic-utils';
import { createStackValue } from '../stack';

interface NumericResultOptions {
	calculateKnownValue: (left: number, right: number) => number;
	deriveIntegerMetadata?: (left: StackItem, right: StackItem) => Partial<StackItem>;
}

/**
 * Resolves two numeric operands to the concrete value kind used by downstream codegen.
 *
 * @param left - Left stack operand.
 * @param right - Right stack operand.
 * @returns The numeric value kind shared through stack-analysis facts.
 */
export function getNumericOperandKind(left: StackItem, right: StackItem): StackAnalysisNumericValueKind {
	if (areAllOperandsIntegers(left, right)) {
		return 'int32';
	}

	return areAllOperandsFloat64(left, right) ? 'float64' : 'float32';
}

/**
 * Builds the stack item produced by a two-operand numeric instruction.
 *
 * @param left - Left stack operand.
 * @param right - Right stack operand.
 * @param options - Integer metadata and known floating-point value derivation.
 * @returns The computed result.
 */
export function numericResult(left: StackItem, right: StackItem, options: NumericResultOptions): StackItem {
	const numericOperandKind = getNumericOperandKind(left, right);
	const isInteger = numericOperandKind === 'int32';
	const integerMetadata = isInteger ? (options.deriveIntegerMetadata?.(left, right) ?? {}) : {};
	const valueType: StackValueType = isInteger ? 'int' : numericOperandKind === 'float64' ? 'float64' : 'float';
	if (isInteger && 'kind' in integerMetadata && integerMetadata.kind === 'address' && integerMetadata.address) {
		return {
			kind: 'address',
			valueType: 'int',
			address: integerMetadata.address,
			...(integerMetadata.pointsTo ? { pointsTo: integerMetadata.pointsTo } : {}),
			...(integerMetadata.knownValue !== undefined
				? {
						knownValue: integerMetadata.knownValue,
						isNonZero: integerMetadata.knownValue !== 0,
					}
				: {}),
		};
	}
	const knownValue = isInteger
		? integerMetadata.knownValue
		: left.knownValue !== undefined && right.knownValue !== undefined
			? options.calculateKnownValue(left.knownValue, right.knownValue)
			: undefined;
	const runtimeKnownValue = valueType === 'float' && knownValue !== undefined ? Math.fround(knownValue) : knownValue;

	return createStackValue(valueType, {
		isNonZero: runtimeKnownValue !== undefined ? runtimeKnownValue !== 0 : false,
		knownValue: runtimeKnownValue,
	});
}

/**
 * Builds an integer stack item from optional known integer metadata.
 *
 * @param knownValue - Known integer value to attach to the stack item.
 * @param isNonZero - Whether the known integer value is known to be non-zero.
 * @returns The computed result.
 */
export function knownIntegerResult(knownValue: number | undefined, isNonZero = false): StackItem {
	return createStackValue('int', {
		isNonZero: knownValue !== undefined ? knownValue !== 0 : isNonZero,
		knownValue,
	});
}
