import type { StackItem } from '@8f4e/language-spec';

/**
 * Returns whether every operand is an integer stack value.
 *
 * @param operands - Stack operands to inspect.
 * @returns Whether the check succeeds.
 */
export function areAllOperandsIntegers(...operands: StackItem[]): boolean {
	return operands.every(operand => operand.valueType === 'int');
}

/**
 * Returns whether every operand is a float64 stack value and at least one operand exists.
 *
 * @param operands - Stack operands to inspect.
 * @returns Whether the check succeeds.
 */
export function areAllOperandsFloat64(...operands: StackItem[]): boolean {
	return operands.length > 0 && operands.every(operand => operand.valueType === 'float64');
}
