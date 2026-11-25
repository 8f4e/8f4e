import type { StackItem } from '@8f4e/language-spec';

/**
 * Derives known integer and non-zero metadata when both operands are compile-time known.
 *
 * @param operand1 - First stack operand.
 * @param operand2 - Second stack operand.
 * @param operation - Operation used to derive the value.
 * @returns The computed result.
 */
export function deriveKnownIntegerValue(
	operand1: StackItem,
	operand2: StackItem,
	operation: (operand1: number, operand2: number) => number | undefined
): Partial<StackItem> {
	if (operand1.knownValue === undefined || operand2.knownValue === undefined) {
		return {};
	}

	const knownValue = operation(operand1.knownValue, operand2.knownValue);

	if (knownValue === undefined) {
		return {};
	}

	return {
		knownValue,
		isNonZero: knownValue !== 0,
	};
}
