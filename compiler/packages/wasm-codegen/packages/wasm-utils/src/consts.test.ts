import { describe, expect, test } from 'vitest';

import { WASM_HEADER, WASM_MEMORY_PAGE_SIZE } from './consts';

describe('wasm constants', () => {
	test('defines the WebAssembly magic header', () => {
		expect(WASM_HEADER).toEqual([0x00, 0x61, 0x73, 0x6d]);
	});

	test('defines the WebAssembly memory page size', () => {
		expect(WASM_MEMORY_PAGE_SIZE).toBe(65536);
	});
});
