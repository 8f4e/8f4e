import type { MemoryViews } from '@8f4e/web-ui';
import type { TooltipLiveValueMemoryFormat } from '../types';

/** Format one live tooltip value using the declaration's storage width and numeric type. */
export function formatMemoryValue(
	memory: MemoryViews,
	byteAddress: number,
	wordAddress: number,
	format: TooltipLiveValueMemoryFormat
): string {
	let values: ArrayLike<number>;
	let index: number;
	if (format.elementWordSize === 1 && format.isInteger) {
		values = format.isUnsigned ? memory.uint8 : memory.int8;
		index = byteAddress;
	} else if (format.elementWordSize === 2 && format.isInteger) {
		values = format.isUnsigned ? memory.uint16 : memory.int16;
		index = byteAddress / 2;
	} else if (format.elementWordSize === 8 && !format.isInteger) {
		values = memory.float64;
		index = byteAddress / 8;
	} else {
		values = format.isInteger ? memory.int32 : memory.float32;
		index = wordAddress;
	}
	if (!Number.isInteger(index) || index < 0 || index >= values.length) return '?';
	const value = values[index];
	return format.isInteger ? String(value) : value.toFixed(4);
}
