import type { MemoryDefaults, PlannedMemoryDeclaration, ValidatedModuleAST } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { createMockState } from '../../../pureHelpers/testingUtils/testUtils';
import type { DirectiveDerivedState } from '../features/directives/registry';
import gaps from '../gaps';
import { createCodeBlockGraphicData } from '../utils/createCodeBlockGraphicData';
import shape, { updateShapeDeclarations } from './updateGraphicData';

function createDirectiveState(): DirectiveDerivedState {
	return {
		blockState: { disabled: false, isHome: false, isFavorite: false },
		displayState: {},
		displayModel: {
			lines: [],
			displayRowToRawRow: [],
			rawRowToDisplayRow: [],
			isCollapsed: false,
		},
		layoutContributions: [],
		layoutCallbacks: [],
	};
}

function createModuleAst(): ValidatedModuleAST {
	return {
		type: 'module',
		id: 'filterA',
		lines: [
			{ lineNumber: 0, instruction: 'module', arguments: [{ value: 'filterA' }] },
			{ lineNumber: 1, instruction: 'shape', arguments: [{ value: 'filterState' }] },
			{ lineNumber: 2, instruction: 'float', arguments: [{ value: 'cutoff' }, { value: 1200 }] },
			{ lineNumber: 3, instruction: 'moduleEnd', arguments: [] },
		],
	} as unknown as ValidatedModuleAST;
}

type MemoryFixture = PlannedMemoryDeclaration & { isInherited?: boolean };

function createMemory(overrides: Partial<MemoryFixture> = {}): MemoryFixture {
	return {
		id: 'memory',
		numberOfElements: 1,
		elementWordSize: 4,
		type: 'float' as const,
		byteAddress: 20,
		allocationUnitAddress: 5,
		allocationUnitCount: 1,
		lineNumber: 1,
		isInteger: false,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};
}

function splitMemoryFixtures(memoryFixtures: Record<string, MemoryFixture>) {
	const memory: Record<string, PlannedMemoryDeclaration> = {};
	const memoryDefaults: MemoryDefaults = {};

	for (const [id, memoryFixture] of Object.entries(memoryFixtures)) {
		const { isInherited = false, ...declaration } = memoryFixture;
		memory[id] = declaration;
		memoryDefaults[id] = { value: 0, isInherited };
	}

	return { memory, memoryDefaults };
}

function createCompilerReports(memoryFixtures: Record<string, MemoryFixture> = {}, ast = createModuleAst()) {
	const { memory, memoryDefaults } = splitMemoryFixtures(memoryFixtures);
	const plannedModule = {
		id: 'filterA',
		lineNumber: 0,
		byteAddress: 0,
		allocationUnitCount: 0,
		allocatedByteLength: 0,
		endByteAddress: 0,
		endAddressSafeByteLength: 0,
		memory,
		declarations: Object.values(memory),
		declarationSources: [],
	};
	return {
		compiledModules: {
			filterA: {
				id: 'filterA',
				index: 0,
				cycleFunction: [],
				ast,
			},
		},
		memoryPlan: {
			modules: {
				filterA: plannedModule,
			},
			moduleList: [plannedModule],
		},
		memoryDefaultsByModuleId: {
			filterA: memoryDefaults,
		},
	};
}

function createInheritedMemory(count: number): Record<string, MemoryFixture> {
	return Object.fromEntries(
		Array.from({ length: count }, (_, index) => [
			`memory${index}`,
			createMemory({ id: `memory${index}`, lineNumber: 1, isInherited: true }),
		])
	);
}

describe('shape', () => {
	it('contributes one layout row per compiler-reported inherited declaration under shape lines', () => {
		const module = createCodeBlockGraphicData({
			blockType: 'module',
			code: ['module filterA', 'shape filterState', 'float cutoff 1200', 'moduleEnd'],
		});
		const state = createMockState({
			compiler: {
				...createCompilerReports(createInheritedMemory(4)),
			},
		});
		const directiveState = createDirectiveState();

		shape(module, state, directiveState);

		expect(directiveState.layoutContributions).toEqual([{ rawRow: 1, rows: 4 }]);
	});

	it('skips modules without compiler-reported shape expansions', () => {
		const module = createCodeBlockGraphicData({
			blockType: 'module',
			code: ['module filterA', 'shape filterState', 'shape missingState', 'moduleEnd'],
		});
		const state = createMockState({
			compiler: {
				...createCompilerReports(),
			},
		});
		const directiveState = createDirectiveState();

		shape(module, state, directiveState);

		expect(directiveState.layoutContributions).toEqual([]);
	});

	it('precomputes inherited declaration labels after gaps are applied', () => {
		const module = createCodeBlockGraphicData({
			blockType: 'module',
			code: ['module filterA', '; @plot other', 'shape filterState', 'moduleEnd'],
			lineNumberColumnWidth: 1,
		});
		const state = createMockState({
			viewport: {
				vGrid: 8,
				hGrid: 16,
			},
			compiler: {
				...createCompilerReports(
					{
						input: createMemory({
							id: 'input',
							lineNumber: 2,
							isInherited: true,
							type: 'float*' as const,
							pointerDepth: 1,
						}),
						output: createMemory({ id: 'output', lineNumber: 2, isInherited: true, type: 'int' as const }),
					},
					{
						...createModuleAst(),
						lines: [
							{ lineNumber: 0, instruction: 'module', arguments: [{ value: 'filterA' }] },
							{ lineNumber: 1, instruction: 'comment', arguments: [] },
							{ lineNumber: 2, instruction: 'shape', arguments: [{ value: 'filterState' }] },
							{ lineNumber: 3, instruction: 'moduleEnd', arguments: [] },
						],
					} as unknown as ValidatedModuleAST
				),
			},
		});
		const directiveState = {
			...createDirectiveState(),
			displayModel: {
				lines: [
					{ rawRow: 0, text: 'module filterA' },
					{ rawRow: 1, text: '; @plot other' },
					{ rawRow: 2, text: 'shape filterState' },
					{ rawRow: 3, text: 'moduleEnd' },
				],
				displayRowToRawRow: [0, 1, 2, 3],
				rawRowToDisplayRow: [0, 1, 2, 3],
				isCollapsed: false,
			},
			layoutContributions: [{ rawRow: 1, rows: 2 }],
		};

		shape(module, state, directiveState);
		gaps(module, directiveState);
		updateShapeDeclarations(module, state, directiveState);

		expect(module.widgets.shapeDeclarations).toEqual([
			{ x: 24, y: 80, text: 'float* input' },
			{ x: 24, y: 96, text: 'int output' },
		]);
	});
});
