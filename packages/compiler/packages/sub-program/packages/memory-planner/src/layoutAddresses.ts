import { ALLOCATION_UNIT_BYTE_SIZE } from '@8f4e/language-spec';

/**
 * Converts an allocation-unit offset relative to a byte base into an absolute byte address.
 *
 * @param startingByteAddress - Absolute byte address where layout should begin.
 * @param allocationUnitOffset - Offset in 4-byte allocation units.
 * @returns The resolved numeric value.
 */
export function getByteAddressFromAllocationUnitOffset(
	startingByteAddress: number,
	allocationUnitOffset: number
): number {
	return startingByteAddress + allocationUnitOffset * ALLOCATION_UNIT_BYTE_SIZE;
}

/**
 * Returns the byte address at the start of an allocation's final allocation unit.
 *
 * @param byteAddress - Byte address where the value should be written.
 * @param allocationUnitCount - Number of reserved 4-byte allocation units.
 * @returns The resolved numeric value.
 */
export function getEndByteAddress(byteAddress: number, allocationUnitCount: number): number {
	if (allocationUnitCount <= 0) {
		return byteAddress;
	}
	return byteAddress + (allocationUnitCount - 1) * ALLOCATION_UNIT_BYTE_SIZE;
}

export function getAllocatedByteLength(allocationUnitCount: number): number {
	return Math.max(0, allocationUnitCount) * ALLOCATION_UNIT_BYTE_SIZE;
}

export function getEndAddressSafeByteLength(allocationUnitCount: number): number {
	return allocationUnitCount > 0 ? ALLOCATION_UNIT_BYTE_SIZE : 0;
}

/**
 * Converts a local allocation-unit offset into an absolute allocation-unit offset.
 *
 * @param startingByteAddress - Absolute byte address where layout should begin.
 * @param localAllocationUnitOffset - Allocation-unit offset relative to the current allocation start.
 * @returns The resolved numeric value.
 */
export function getAbsoluteAllocationUnitOffset(
	startingByteAddress: number,
	localAllocationUnitOffset: number
): number {
	return startingByteAddress / ALLOCATION_UNIT_BYTE_SIZE + localAllocationUnitOffset;
}

/**
 * Aligns 64-bit allocations to an even absolute allocation-unit offset.
 *
 * @param absoluteAllocationUnitOffset - Absolute offset in 4-byte allocation units.
 * @param elementWordSize - Typed element width in bytes, used to align the absolute offset.
 * @returns The resolved numeric value.
 */
export function alignAbsoluteAllocationUnitOffset(
	absoluteAllocationUnitOffset: number,
	elementWordSize: number
): number {
	if (elementWordSize !== 8 || absoluteAllocationUnitOffset % 2 === 0) {
		return absoluteAllocationUnitOffset;
	}

	return absoluteAllocationUnitOffset + 1;
}
