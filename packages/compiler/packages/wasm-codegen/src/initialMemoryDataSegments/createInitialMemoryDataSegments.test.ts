import { describe, expect, test } from 'vitest';
import {
	createMemory,
	createMemoryDefault,
	createMemoryDefaults,
	createMemoryPlan,
	serializeSegments,
} from '../../tests/initialMemoryDataSegments/testUtils';
import createInitialMemoryDataSegments from './createInitialMemoryDataSegments';

describe('createInitialMemoryDataSegments', () => {
	test('skips implicit zero defaults while retaining non-zero and explicit defaults', () => {
		const memoryPlan = createMemoryPlan({
			scalarZero: createMemory({ id: 0, name: 'scalarZero', byteAddress: 0 }),
			scalarValue: createMemory({ id: 1, name: 'scalarValue', byteAddress: 4 }),
			implicitArray: createMemory({
				id: 2,
				name: 'implicitArray',
				byteAddress: 8,
				numberOfElements: 4,
				allocationUnitCount: 4,
			}),
			explicitArray: createMemory({
				id: 3,
				name: 'explicitArray',
				byteAddress: 24,
				numberOfElements: 3,
				allocationUnitCount: 3,
			}),
			explicitScalarZero: createMemory({
				id: 4,
				name: 'explicitScalarZero',
				byteAddress: 36,
			}),
		});
		const memoryDefaultsByModuleId = createMemoryDefaults({
			0: createMemoryDefault(0),
			1: createMemoryDefault(5),
			2: createMemoryDefault({}),
			3: createMemoryDefault({ 1: 2 }, { hasExplicitDefault: true }),
			4: createMemoryDefault(0, { hasExplicitDefault: true }),
		});

		expect(serializeSegments(createInitialMemoryDataSegments(memoryPlan, memoryDefaultsByModuleId))).toEqual([
			{
				byteAddress: 4,
				bytes: [5, 0, 0, 0, ...new Array(16).fill(0), 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			},
		]);
	});

	test('skips explicit zero-filled array defaults', () => {
		const memoryPlan = createMemoryPlan({
			zeroArray: createMemory({
				id: 0,
				name: 'zeroArray',
				byteAddress: 0,
				numberOfElements: 2,
				allocationUnitCount: 2,
			}),
		});
		const memoryDefaultsByModuleId = createMemoryDefaults({
			0: createMemoryDefault({ 0: 0 }, { hasExplicitDefault: true }),
		});

		expect(serializeSegments(createInitialMemoryDataSegments(memoryPlan, memoryDefaultsByModuleId))).toEqual([]);
	});
});
