import type { ProjectObjectModel } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import compileProjectModules from '../src/compile/compileProjectModules';

function projectWithModules(modules: ProjectObjectModel['modules']): ProjectObjectModel {
	return {
		code: [],
		modules,
		functions: [],
		constants: [],
		prototypes: [],
		includes: [],
		notes: [],
		unknown: [],
		groups: [],
	};
}

describe('compileProjectModules', () => {
	it('resolves nth references across project file order', async () => {
		const result = await compileProjectModules(
			projectWithModules([
				{
					id: 1,
					code: ['module target', '; @pos -71 -28', 'int* ptr &source:0', 'moduleEnd'],
					entry: 'main',
				},
				{
					id: 2,
					code: ['module source', '; @pos -141 -28', 'int value 0', 'moduleEnd'],
					entry: 'main',
				},
			]),
			{
				compilerOptions: { startingMemoryAllocationUnitAddress: 0 },
			}
		);

		expect(result.compiledModules.target.index).toBe(0);
		expect(result.compiledModules.source.index).toBe(1);
		expect(result.memoryDefaultsByModuleId.target!.ptr!.value).toBe(
			result.memoryPlan.modules.source!.memory.value!.byteAddress
		);
	});

	it('preserves file order when module blocks are already ordered', async () => {
		const result = await compileProjectModules(
			projectWithModules([
				{
					id: 1,
					code: ['module source', '; @pos -141 -28', 'int value 0', 'moduleEnd'],
					entry: 'main',
				},
				{
					id: 2,
					code: ['module target', '; @pos -71 -28', 'int* ptr &source:0', 'moduleEnd'],
					entry: 'main',
				},
			]),
			{
				compilerOptions: { startingMemoryAllocationUnitAddress: 0 },
			}
		);

		expect(result.compiledModules.source.index).toBe(0);
		expect(result.compiledModules.target.index).toBe(1);
		expect(result.memoryDefaultsByModuleId.target!.ptr!.value).toBe(
			result.memoryPlan.modules.source!.memory.value!.byteAddress
		);
	});

	it('preserves explicit execution entries on compiled modules', async () => {
		const result = await compileProjectModules(
			projectWithModules([
				{
					id: 1,
					code: ['module addWorks', 'push 1', 'drop', 'moduleEnd'],
					entry: 'test',
				},
			]),
			{
				compilerOptions: { startingMemoryAllocationUnitAddress: 0 },
			}
		);

		expect(result.compiledModules.addWorks.executionEntryName).toBe('test');
	});

	it('compiles test dependencies as ordinary blocks', async () => {
		const result = await compileProjectModules(
			projectWithModules([
				{
					id: 1,
					code: ['module target', 'int* ptr &dependency:value', 'push *ptr', 'drop', 'moduleEnd'],
					entry: 'test',
				},
				{
					id: 2,
					code: ['module dependency', 'int value 42', 'moduleEnd'],
					entry: 'main',
				},
			]),
			{
				compilerOptions: { startingMemoryAllocationUnitAddress: 0 },
			}
		);

		expect(result.compiledModules.target.executionEntryName).toBe('test');
		expect(result.compiledModules.dependency.executionEntryName).toBe('main');
	});

	it('compiles projects whose program blocks are contained by groups', async () => {
		const result = await compileProjectModules(
			{
				...projectWithModules([]),
				groups: [
					{
						...projectWithModules([
							{
								id: 2,
								code: ['module source', 'int value 42', 'moduleEnd'],
								entry: 'main',
							},
						]),
						id: 1,
						name: 'nested',
						code: ['group nested', 'groupEnd'],
						exposures: [],
					},
				],
			},
			{
				compilerOptions: { startingMemoryAllocationUnitAddress: 0 },
			}
		);

		expect(result.compiledModules['nested/source']).toBeDefined();
	});

	it('compiles included functions resolved from includes blocks with parsed project modules', async () => {
		const result = await compileProjectModules(
			{
				...projectWithModules([
					{
						id: 2,
						code: ['module target', 'call includedOne', 'drop', 'moduleEnd'],
						entry: 'main',
					},
				]),
				includes: [{ id: 1, code: ['includes', 'include std/test/includedOne', 'includesEnd'] }],
			},
			{
				compilerOptions: { startingMemoryAllocationUnitAddress: 0 },
				resolveInclude: includeId =>
					includeId === 'std/test/includedOne'
						? ['function includedOne', '#export', 'push 1', 'functionEnd int'].join('\n')
						: undefined,
			}
		);

		expect(result.compiledModules.target).toBeDefined();
	});
});
