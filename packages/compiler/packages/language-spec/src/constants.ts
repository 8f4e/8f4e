import { BASE_TYPE_METADATA } from './memory';

// Global allocation grid is 4 bytes so memory maps cleanly to Int32Array/Float32Array views.
// float64 declarations require an even allocation-unit offset (8-byte boundary) so their byteAddress is
// divisible by 8, enabling safe Float64Array / DataView access. Any required alignment gap
// (0 or 1 allocation unit) is absorbed into the float64 entry's allocationUnitCount.
export const ALLOCATION_UNIT_BYTE_SIZE = BASE_TYPE_METADATA.int.wordSize;
export const BYTE_MEMORY_ACCESS_WIDTH = BASE_TYPE_METADATA.int8.wordSize;
export const HALF_WORD_MEMORY_ACCESS_WIDTH = BASE_TYPE_METADATA.int16.wordSize;
export const WORD_MEMORY_ACCESS_WIDTH = ALLOCATION_UNIT_BYTE_SIZE;
export const DOUBLE_WORD_MEMORY_ACCESS_WIDTH = BASE_TYPE_METADATA.float64.wordSize;
export const SUPPORTED_MEMORY_ACCESS_BYTE_WIDTHS = Array.from(
	new Set(
		Object.values(BASE_TYPE_METADATA)
			.map(({ wordSize }) => wordSize)
			.sort((left, right) => left - right)
	)
);

export { WASM_MEMORY_PAGE_SIZE } from '@8f4e/compiler-wasm-utils';
