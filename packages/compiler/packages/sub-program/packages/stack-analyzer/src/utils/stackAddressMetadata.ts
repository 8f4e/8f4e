import type { MemoryAddressRange, StackAddress, StackItem } from '@8f4e/language-spec';

/** Shifts a proven safe range forward by a known byte offset, dropping it when unsafe. */
function shiftSafeRange(safeRange: MemoryAddressRange, byteOffset: number): MemoryAddressRange | undefined {
	if (!Number.isInteger(byteOffset) || byteOffset < 0 || byteOffset > safeRange.safeByteLength) {
		return undefined;
	}

	return {
		...safeRange,
		byteAddress: safeRange.byteAddress + byteOffset,
		safeByteLength: safeRange.safeByteLength - byteOffset,
	};
}

/**
 * Derives known-value, pointee-type, and independently proven range metadata for stack addition.
 *
 * @param operand1 - First stack operand.
 * @param operand2 - Second stack operand.
 * @returns The computed result.
 */
export function deriveAddStackMetadata(operand1: StackItem, operand2: StackItem): Partial<StackItem> {
	const knownValue =
		operand1.knownValue !== undefined && operand2.knownValue !== undefined
			? operand1.knownValue + operand2.knownValue
			: undefined;
	const addressOperand = operand1.kind === 'address' ? operand1 : operand2.kind === 'address' ? operand2 : undefined;
	const offsetOperand = addressOperand === operand1 ? operand2 : operand1;
	const safeRange =
		addressOperand?.address.safeRange && offsetOperand.knownValue !== undefined
			? shiftSafeRange(addressOperand.address.safeRange, offsetOperand.knownValue)
			: undefined;
	const clampRange = addressOperand?.address.clampRange ?? addressOperand?.address.safeRange;
	const pointsTo = addressOperand?.pointsTo;

	return {
		...(knownValue !== undefined ? { knownValue } : {}),
		...(addressOperand
			? {
					kind: 'address',
					valueType: 'int',
					address: {
						...(safeRange ? { safeRange } : {}),
						...(clampRange ? { clampRange } : {}),
					},
					...(pointsTo ? { pointsTo } : {}),
				}
			: {}),
	} as Partial<StackAddress>;
}

/**
 * Derives address metadata for address-minus-offset and a plain integer value for address differences.
 *
 * @param operand1 - First stack operand.
 * @param operand2 - Second stack operand.
 * @returns The computed result.
 */
export function deriveSubStackMetadata(operand1: StackItem, operand2: StackItem): Partial<StackItem> {
	const knownValue =
		operand1.knownValue !== undefined && operand2.knownValue !== undefined
			? operand1.knownValue - operand2.knownValue
			: undefined;
	const addressOperand = operand1.kind === 'address' && operand2.kind !== 'address' ? operand1 : undefined;
	const safeRange =
		addressOperand?.address.safeRange && operand2.knownValue !== undefined
			? shiftSafeRange(addressOperand.address.safeRange, -operand2.knownValue)
			: undefined;
	const clampRange = addressOperand?.address.clampRange ?? addressOperand?.address.safeRange;
	const pointsTo = addressOperand?.pointsTo;

	return {
		...(knownValue !== undefined ? { knownValue } : {}),
		...(addressOperand
			? {
					kind: 'address',
					valueType: 'int',
					address: {
						...(safeRange ? { safeRange } : {}),
						...(clampRange ? { clampRange } : {}),
					},
					...(pointsTo ? { pointsTo } : {}),
				}
			: {}),
	} as Partial<StackAddress>;
}
