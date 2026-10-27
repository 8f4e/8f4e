import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { MemoryViews } from '@8f4e/web-ui';

export interface WatchValueFormat {
	elementWordSize: number;
	isInteger: boolean;
	isUnsigned: boolean;
}

// Hot render path: cache byte-to-hex conversion once so per-frame formatting avoids repeated allocations.
const HEX_BYTE_LOOKUP = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));
const INVALID_VALUE = '?';

function readMemoryValue(view: ArrayLike<number>, index: number): number | undefined {
	if (!Number.isInteger(index) || index < 0 || index >= view.length) {
		return undefined;
	}

	return view[index];
}

function formatHexBytes(memoryViews: MemoryViews, byteAddress: number, elementWordSize: number): string {
	const byteEnd = byteAddress + elementWordSize;
	if (
		!Number.isInteger(byteAddress) ||
		!Number.isInteger(elementWordSize) ||
		byteAddress < 0 ||
		elementWordSize <= 0 ||
		byteEnd > memoryViews.uint8.length
	) {
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

export function formatWatchValueAtAddress(
	memoryViews: MemoryViews,
	byteAddress: number,
	allocationUnitAddress: number,
	format: WatchValueFormat,
	displayFormat: 'decimal' | 'binary' | 'hex'
): string {
	if (displayFormat === 'hex') {
		return formatHexBytes(memoryViews, byteAddress, format.elementWordSize);
	}

	const radixMap = { decimal: 10, binary: 2 } as const;
	const radix = radixMap[displayFormat];

	if (format.elementWordSize === 1 && format.isInteger) {
		const view = format.isUnsigned ? memoryViews.uint8 : memoryViews.int8;
		const value = readMemoryValue(view, byteAddress);
		return value === undefined ? INVALID_VALUE : value.toString(radix);
	}

	if (format.elementWordSize === 2 && format.isInteger) {
		const view = format.isUnsigned ? memoryViews.uint16 : memoryViews.int16;
		const value = readMemoryValue(view, byteAddress / 2);
		return value === undefined ? INVALID_VALUE : value.toString(radix);
	}

	if (format.elementWordSize === 8 && !format.isInteger) {
		const value = readMemoryValue(memoryViews.float64, byteAddress / 8);
		return value === undefined ? INVALID_VALUE : value.toFixed(4);
	}

	const view = format.isInteger ? memoryViews.int32 : memoryViews.float32;
	const value = readMemoryValue(view, allocationUnitAddress);
	if (value === undefined) {
		return INVALID_VALUE;
	}

	return format.isInteger ? value.toString(radix) : value.toFixed(4);
}

export default function formatWatchValue(
	memoryViews: MemoryViews,
	memory: PlannedMemoryDeclaration,
	bufferPointer: number,
	displayFormat: 'decimal' | 'binary' | 'hex'
): string {
	return formatWatchValueAtAddress(
		memoryViews,
		memory.byteAddress + bufferPointer * memory.elementWordSize,
		memory.allocationUnitAddress + bufferPointer,
		memory,
		displayFormat
	);
}
