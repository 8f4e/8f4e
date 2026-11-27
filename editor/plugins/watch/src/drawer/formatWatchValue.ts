import { type PreparedNumericRead, readByteAddress, readNumericValue } from '@8f4e/editor-state/memory';
import type { MemoryViews } from '@8f4e/web-ui';

// Hot render path: cache byte-to-hex conversion once so per-frame formatting avoids repeated allocations.
const HEX_BYTE_LOOKUP = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));
const INVALID_VALUE = '?';

function formatHexBytes(memoryViews: MemoryViews, byteAddress: number, elementWordSize: number): string {
	const byteEnd = byteAddress + elementWordSize;
	if (byteEnd > memoryViews.uint8.length) {
		return INVALID_VALUE;
	}

	let result = '';

	// Iterate the backing bytes directly instead of building temporary arrays in the render loop.
	for (let index = byteEnd - 1; index >= byteAddress; index--) {
		if (result) {
			result += ' ';
		}

		result += HEX_BYTE_LOOKUP[memoryViews.uint8[index]];
	}

	return result;
}

export default function formatWatchValue(
	memoryViews: MemoryViews,
	read: PreparedNumericRead,
	displayFormat: 'decimal' | 'binary' | 'hex'
): string {
	if (displayFormat === 'hex') {
		const byteAddress = readByteAddress(read.address, memoryViews.int32);
		return byteAddress === undefined
			? INVALID_VALUE
			: formatHexBytes(memoryViews, byteAddress, read.spec.elementByteSize);
	}

	const radixMap = { decimal: 10, binary: 2 } as const;
	const radix = radixMap[displayFormat];

	const value = readNumericValue(read, memoryViews);
	if (value === undefined) {
		return INVALID_VALUE;
	}

	return read.spec.isInteger ? value.toString(radix) : value.toFixed(4);
}
