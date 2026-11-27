import { describe, expect, test } from 'vitest';

import { WASM_MEMORY_PAGE_SIZE } from './consts';
import { deriveEffectiveMemorySize } from './deriveEffectiveMemorySize';

describe('deriveEffectiveMemorySize', () => {
	test('returns minimum 1 page for zero bytes', () => {
		expect(deriveEffectiveMemorySize(0)).toBe(WASM_MEMORY_PAGE_SIZE);
	});

	test('returns minimum 1 page for small requirements', () => {
		expect(deriveEffectiveMemorySize(1)).toBe(WASM_MEMORY_PAGE_SIZE);
		expect(deriveEffectiveMemorySize(100)).toBe(WASM_MEMORY_PAGE_SIZE);
		expect(deriveEffectiveMemorySize(WASM_MEMORY_PAGE_SIZE - 1)).toBe(WASM_MEMORY_PAGE_SIZE);
	});

	test('returns exact page when requirement is exactly 1 page', () => {
		expect(deriveEffectiveMemorySize(WASM_MEMORY_PAGE_SIZE)).toBe(WASM_MEMORY_PAGE_SIZE);
	});

	test('rounds up to 2 pages when requirement exceeds 1 page', () => {
		expect(deriveEffectiveMemorySize(WASM_MEMORY_PAGE_SIZE + 1)).toBe(WASM_MEMORY_PAGE_SIZE * 2);
		expect(deriveEffectiveMemorySize(WASM_MEMORY_PAGE_SIZE * 1.5)).toBe(WASM_MEMORY_PAGE_SIZE * 2);
	});

	test('returns exact 2 pages when requirement is exactly 2 pages', () => {
		expect(deriveEffectiveMemorySize(WASM_MEMORY_PAGE_SIZE * 2)).toBe(WASM_MEMORY_PAGE_SIZE * 2);
	});

	test('rounds up correctly for arbitrary requirements', () => {
		expect(deriveEffectiveMemorySize(WASM_MEMORY_PAGE_SIZE * 2 + 1)).toBe(WASM_MEMORY_PAGE_SIZE * 3);
		expect(deriveEffectiveMemorySize(WASM_MEMORY_PAGE_SIZE * 10)).toBe(WASM_MEMORY_PAGE_SIZE * 10);
		expect(deriveEffectiveMemorySize(WASM_MEMORY_PAGE_SIZE * 10 + 1)).toBe(WASM_MEMORY_PAGE_SIZE * 11);
	});

	test('handles typical memory footprints', () => {
		expect(deriveEffectiveMemorySize(1024)).toBe(WASM_MEMORY_PAGE_SIZE);
		expect(deriveEffectiveMemorySize(102400)).toBe(WASM_MEMORY_PAGE_SIZE * 2);
		expect(deriveEffectiveMemorySize(1048576)).toBe(WASM_MEMORY_PAGE_SIZE * 16);
	});
});
