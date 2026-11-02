import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
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
	memory: PlannedMemoryDeclaration,
	bufferPointer: number,
	displayFormat: 'decimal' | 'binary' | 'hex'
): string {
	const byteAddress = memory.byteAddress + bufferPointer * memory.elementWordSize;
	if (displayFormat === 'hex') {
		return formatHexBytes(memoryViews, byteAddress, memory.elementWordSize);
	}

	const radixMap = { decimal: 10, binary: 2 } as const;
	const radix = radixMap[displayFormat];

	if (memory.elementWordSize === 1 && memory.isInteger) {
		const view = memory.isUnsigned ? memoryViews.uint8 : memoryViews.int8;
		const value = view[byteAddress];
		return value === undefined ? INVALID_VALUE : value.toString(radix);
	}

	if (memory.elementWordSize === 2 && memory.isInteger) {
		const view = memory.isUnsigned ? memoryViews.uint16 : memoryViews.int16;
		const value = view[byteAddress / 2];
		return value === undefined ? INVALID_VALUE : value.toString(radix);
	}

	if (memory.elementWordSize === 8 && !memory.isInteger) {
		const value = memoryViews.float64[byteAddress / 8];
		return value === undefined ? INVALID_VALUE : value.toFixed(4);
	}

	const view = memory.isInteger ? memoryViews.int32 : memoryViews.float32;
	const value = view[memory.allocationUnitAddress + bufferPointer];
	if (value === undefined) {
		return INVALID_VALUE;
	}

	return memory.isInteger ? value.toString(radix) : value.toFixed(4);
}
