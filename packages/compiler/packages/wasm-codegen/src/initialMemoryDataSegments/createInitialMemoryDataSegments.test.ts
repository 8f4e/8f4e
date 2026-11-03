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
			scalarZero: createMemory({ id: 'scalarZero', byteAddress: 0 }),
			scalarValue: createMemory({ id: 'scalarValue', byteAddress: 4 }),
			implicitArray: createMemory({
				id: 'implicitArray',
				byteAddress: 8,
				numberOfElements: 4,
				allocationUnitCount: 4,
			}),
			explicitArray: createMemory({
				id: 'explicitArray',
				byteAddress: 24,
				numberOfElements: 3,
				allocationUnitCount: 3,
			}),
			explicitScalarZero: createMemory({
				id: 'explicitScalarZero',
				byteAddress: 36,
			}),
		});
		const memoryDefaultsByModuleId = createMemoryDefaults({
			scalarZero: createMemoryDefault(0),
			scalarValue: createMemoryDefault(5),
			implicitArray: createMemoryDefault({}),
			explicitArray: createMemoryDefault({ 1: 2 }, { hasExplicitDefault: true }),
			explicitScalarZero: createMemoryDefault(0, { hasExplicitDefault: true }),
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
				id: 'zeroArray',
				byteAddress: 0,
				numberOfElements: 2,
				allocationUnitCount: 2,
			}),
		});
		const memoryDefaultsByModuleId = createMemoryDefaults({
			zeroArray: createMemoryDefault({ 0: 0 }, { hasExplicitDefault: true }),
		});

		expect(serializeSegments(createInitialMemoryDataSegments(memoryPlan, memoryDefaultsByModuleId))).toEqual([]);
	});
});
