import { compileProject } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import type { ProgramMemoryStructure } from '../didProgramOrMemoryStructureChange';
import getOrCreateMemory from '../getOrCreateMemory';

describe('getOrCreateMemory', () => {
	async function createProgramMemoryStructure(moduleIds = ['module1']): Promise<ProgramMemoryStructure> {
		const result = await compileProject(
			{
				entries: ['main'],
				code: [],
				execution: [
					...moduleIds.map((id, projectBlockId) => ({
						type: 'module' as const,
						id: projectBlockId,
						entry: 'main',
						code: [`module ${id}`, 'int value 0', 'moduleEnd'],
					})),
				],
				functions: [],
				constants: [],
				prototypes: [],
				includes: [],
				notes: [],
				unknown: [],
			},
			{ startingMemoryAllocationUnitAddress: 0 }
		);

		return {
			compiledModules: result.compiledModules,
			memoryPlan: result.memoryPlan,
		};
	}

	describe('memory action reporting', () => {
		it('should report "no-instance" reason when memory is created for the first time', async () => {
			const current = await createProgramMemoryStructure();
			const result = getOrCreateMemory(65536, current);

			expect(result.memoryAction).toEqual({
				action: 'recreated',
				reason: { kind: 'no-instance' },
			});
			expect(result.memoryRef).toBeInstanceOf(WebAssembly.Memory);
		});

		it('should report "memory-size-changed" reason when memory size changes', async () => {
			// First call creates initial memory
			const previous = await createProgramMemoryStructure();
			getOrCreateMemory(65536, previous);

			// Second call with different size
			const current = await createProgramMemoryStructure();
			const result = getOrCreateMemory(131072, current, previous);

			expect(result.memoryAction).toEqual({
				action: 'recreated',
				reason: {
					kind: 'memory-size-changed',
					prevBytes: 65536,
					nextBytes: 131072,
				},
			});
		});

		it('should report "memory-structure-changed" reason when structure changes', async () => {
			// First call creates initial memory
			const previous = await createProgramMemoryStructure();
			getOrCreateMemory(65536, previous);

			// Second call with same size but structure changed (different module count)
			const current = await createProgramMemoryStructure(['module1', 'module2']);
			const result = getOrCreateMemory(65536, current, previous);

			expect(result.memoryAction).toEqual({
				action: 'recreated',
				reason: { kind: 'memory-structure-changed' },
			});
		});

		it('should report "reused" action when memory is reused', async () => {
			// First call creates initial memory
			const previous = await createProgramMemoryStructure();
			getOrCreateMemory(65536, previous);

			// Second call with same size and no structure change
			const current = await createProgramMemoryStructure();
			const result = getOrCreateMemory(65536, current, previous);

			expect(result.memoryAction).toEqual({
				action: 'reused',
			});
		});

		it('should prioritize memory-size-changed over memory-structure-changed when both occur', async () => {
			// First call creates initial memory
			const previous = await createProgramMemoryStructure();
			getOrCreateMemory(65536, previous);

			// Second call with both size and structure changed
			const current = await createProgramMemoryStructure(['module1', 'module2']);
			const result = getOrCreateMemory(131072, current, previous);

			expect(result.memoryAction).toEqual({
				action: 'recreated',
				reason: {
					kind: 'memory-size-changed',
					prevBytes: 65536,
					nextBytes: 131072,
				},
			});
		});
	});

	describe('memory creation behavior', () => {
		it('should create shared memory with correct page count', async () => {
			const memorySizeBytes = 65536 * 2; // 2 pages
			const current = await createProgramMemoryStructure();
			const result = getOrCreateMemory(memorySizeBytes, current);

			expect(result.memoryRef).toBeInstanceOf(WebAssembly.Memory);
			expect(result.memoryRef.buffer.byteLength).toBe(memorySizeBytes);
		});

		it('should round up memory size to page boundary', async () => {
			// Request slightly more than 1 page
			const memorySizeBytes = 65536 + 1;
			const current = await createProgramMemoryStructure();
			const result = getOrCreateMemory(memorySizeBytes, current);

			// Should allocate 2 full pages
			expect(result.memoryRef.buffer.byteLength).toBe(65536 * 2);
		});
	});
});
