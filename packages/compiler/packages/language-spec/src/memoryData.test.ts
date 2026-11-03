import { describe, expect, it } from 'vitest';
import { ALLOCATION_UNIT_BYTE_SIZE } from './constants';
import type { PlannedMemoryDeclaration, PointeeBaseType } from './memory';
import {
	getDereferencedValueKindFromMetadata,
	getDereferencedValueWordSizeFromMetadata,
	getElementCount,
	getElementMaxValue,
	getElementMinValue,
	getElementWordSize,
	getPointeeElementIsIntegerFromMetadata,
	getPointeeElementMaxValue,
	getPointeeElementMinValue,
	getPointeeElementWordSize,
	type PointerMetadata,
} from './memoryData';

function memory(overrides: Partial<PlannedMemoryDeclaration> = {}): PlannedMemoryDeclaration {
	const byteAddress = overrides.byteAddress ?? 100;
	const declaration = {
		id: 'memory',
		type: 'int' as const,
		numberOfElements: 10,
		elementWordSize: 4,
		byteAddress,
		allocationUnitAddress: byteAddress / ALLOCATION_UNIT_BYTE_SIZE,
		allocationUnitCount: 5,
		lineNumber: 1,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};

	return {
		...declaration,
		elementByteLength: declaration.numberOfElements * declaration.elementWordSize,
		allocatedByteLength: Math.max(0, declaration.allocationUnitCount) * ALLOCATION_UNIT_BYTE_SIZE,
		endByteAddress:
			declaration.allocationUnitCount <= 0
				? declaration.byteAddress
				: declaration.byteAddress + (declaration.allocationUnitCount - 1) * ALLOCATION_UNIT_BYTE_SIZE,
		endAddressSafeByteLength: declaration.allocationUnitCount > 0 ? ALLOCATION_UNIT_BYTE_SIZE : 0,
	};
}

function pointer(pointeeBaseType: PointeeBaseType, overrides: Partial<PointerMetadata> = {}): PointerMetadata {
	return {
		pointeeBaseType,
		pointerDepth: 1,
		...overrides,
	} as PointerMetadata;
}

describe('memoryData utilities', () => {
	describe('planned declaration helpers', () => {
		it('returns declared element count and word size', () => {
			const declaration = memory({ numberOfElements: 16, elementWordSize: 2 });
			expect(getElementCount(declaration)).toBe(16);
			expect(getElementWordSize(declaration)).toBe(2);
		});
	});

	describe('pointer metadata helpers', () => {
		it.each([
			['int', 1, 4],
			['float', 1, 4],
			['float64', 1, 8],
			['int8', 1, 1],
			['int16', 1, 2],
			['int', 2, 4],
			['float64', 2, 4],
		] as Array<[PointeeBaseType, number, number]>)(
			'returns expected word size for %s pointer depth %i',
			(pointeeBaseType, pointerDepth, expectedWordSize) => {
				expect(getPointeeElementWordSize(pointer(pointeeBaseType, { pointerDepth }))).toBe(expectedWordSize);
			}
		);

		it('returns zero for missing pointer metadata', () => {
			expect(getPointeeElementWordSize(undefined)).toBe(0);
			expect(getPointeeElementMaxValue(undefined)).toBe(0);
			expect(getPointeeElementMinValue(undefined)).toBe(0);
		});

		it('classifies pointee and dereferenced value kinds', () => {
			const float64DoublePointer = pointer('float64', { pointerDepth: 2 });
			const float64Pointer = pointer('float64');
			const int16Pointer = pointer('int16');
			const int8uPointer = pointer('int8u');

			expect(getPointeeElementIsIntegerFromMetadata(float64DoublePointer)).toBe(true);
			expect(getDereferencedValueKindFromMetadata(float64DoublePointer, 1)).toBe('int32');
			expect(getDereferencedValueKindFromMetadata(float64DoublePointer)).toBe('float64');
			expect(getDereferencedValueWordSizeFromMetadata(float64DoublePointer)).toBe(8);

			expect(getPointeeElementIsIntegerFromMetadata(float64Pointer)).toBe(false);
			expect(getDereferencedValueKindFromMetadata(float64Pointer, 1)).toBe('float64');

			expect(getPointeeElementIsIntegerFromMetadata(int16Pointer)).toBe(true);
			expect(getDereferencedValueKindFromMetadata(int16Pointer, 1)).toBe('int32');
			expect(getDereferencedValueWordSizeFromMetadata(int16Pointer)).toBe(2);

			expect(getPointeeElementIsIntegerFromMetadata(int8uPointer)).toBe(true);
			expect(getDereferencedValueWordSizeFromMetadata(int8uPointer)).toBe(1);
		});
	});

	describe('declared element value ranges', () => {
		it.each([
			[4, true, false, 2147483647, -2147483648],
			[2, true, false, 32767, -32768],
			[1, true, false, 127, -128],
			[4, false, false, 3.4028234663852886e38, -3.4028234663852886e38],
			[8, false, false, 1.7976931348623157e308, -1.7976931348623157e308],
			[1, true, true, 255, 0],
			[2, true, true, 65535, 0],
			[4, true, true, 4294967295, 0],
		])(
			'returns range for wordSize=%i integer=%s unsigned=%s',
			(elementWordSize, isInteger, isUnsigned, expectedMax, expectedMin) => {
				const declaration = memory({ elementWordSize, isInteger, isUnsigned });
				expect(getElementMaxValue(declaration)).toBe(expectedMax);
				expect(getElementMinValue(declaration)).toBe(expectedMin);
			}
		);
	});

	describe('pointee value ranges', () => {
		it.each([
			['int', 1, 2147483647, -2147483648],
			['int8', 1, 127, -128],
			['int16', 1, 32767, -32768],
			['int8u', 1, 255, 0],
			['int16u', 1, 65535, 0],
			['float', 1, 3.4028234663852886e38, -3.4028234663852886e38],
			['float64', 1, 1.7976931348623157e308, -1.7976931348623157e308],
			['float64', 2, 2147483647, -2147483648],
		] as Array<[PointeeBaseType, number, number, number]>)(
			'returns range for %s pointer depth %i',
			(pointeeBaseType, pointerDepth, expectedMax, expectedMin) => {
				const metadata = pointer(pointeeBaseType, { pointerDepth });
				expect(getPointeeElementMaxValue(metadata)).toBe(expectedMax);
				expect(getPointeeElementMinValue(metadata)).toBe(expectedMin);
			}
		);
	});
});
