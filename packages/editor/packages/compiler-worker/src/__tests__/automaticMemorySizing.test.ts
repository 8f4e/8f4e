import type { ProjectObjectModel } from '@8f4e/language-spec';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type compileAndUpdateMemoryType from '../compileAndUpdateMemory';

function createInput(modules: Array<{ code: string[] }>): ProjectObjectModel {
	return {
		code: [],
		modules: modules.map((module, id) => ({ ...module, id, entry: 'main' })),
		constants: [],
		functions: [],
		prototypes: [],
		includes: [],
		notes: [],
		unknown: [],
		groups: [],
	};
}

describe('automatic memory sizing', () => {
	let compileAndUpdateMemory: typeof compileAndUpdateMemoryType;

	beforeEach(async () => {
		vi.resetModules();
		({ default: compileAndUpdateMemory } = await import('../compileAndUpdateMemory'));
	});

	it('should automatically derive required memory and allocate pages in the host', async () => {
		const modules = [
			{
				code: ['module test', 'int x', 'int y', 'moduleEnd'],
			},
		];

		const result = await compileAndUpdateMemory(createInput(modules), {
			startingMemoryAllocationUnitAddress: 0,
		});

		// Should have successfully compiled
		expect(result.compiledModules).toBeDefined();
		expect(result.requiredMemoryBytes).toBeGreaterThan(0);
		expect(result.allocatedMemoryBytes).toBe(65536);
		expect(result.memoryRef).toBeInstanceOf(WebAssembly.Memory);

		// Memory should be at least 1 WASM page (64 KiB) and page-aligned
		expect(result.memoryRef.buffer.byteLength).toBeGreaterThanOrEqual(65536);
		expect(result.memoryRef.buffer.byteLength % 65536).toBe(0);
	});

	it('should allocate minimum 1 page even for tiny programs', async () => {
		const modules = [
			{
				code: ['module test', 'int x', 'moduleEnd'],
			},
		];

		const result = await compileAndUpdateMemory(createInput(modules), {
			startingMemoryAllocationUnitAddress: 0,
		});

		// Should allocate at least 64 KiB (1 page)
		expect(result.memoryRef.buffer.byteLength).toBe(65536);
		expect(result.requiredMemoryBytes).toBeLessThan(65536); // Actual usage should be less than 1 page
		expect(result.requiredMemoryBytes).toBeGreaterThan(0);
		expect(result.allocatedMemoryBytes).toBe(65536);
	});
});
