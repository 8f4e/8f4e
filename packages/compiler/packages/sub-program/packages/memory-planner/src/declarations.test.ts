import { describe, expect, it } from 'vitest';
import { planArrayDeclarationLayout, planScalarDeclarationLayout } from './declarations';

describe('memory declaration layout planner', () => {
	const float64Starts = [
		{ startingByteAddress: 4, localAllocationUnitOffset: 0, byteAddress: 8, padding: 1 },
		{ startingByteAddress: 8, localAllocationUnitOffset: 0, byteAddress: 8, padding: 0 },
		{ startingByteAddress: 4, localAllocationUnitOffset: 1, byteAddress: 8, padding: 0 },
		{ startingByteAddress: 8, localAllocationUnitOffset: 1, byteAddress: 16, padding: 1 },
	];

	it.each(float64Starts)(
		'keeps scalar float64 bounds inside its storage at base $startingByteAddress and offset $localAllocationUnitOffset',
		({ startingByteAddress, localAllocationUnitOffset, byteAddress, padding }) => {
			const result = planScalarDeclarationLayout({
				id: 'value',
				lineNumber: 1,
				instruction: 'float64',
				startingByteAddress,
				localAllocationUnitOffset,
			});
			expect(result.declaration).toMatchObject({
				byteAddress,
				allocationUnitCount: padding + 2,
				allocatedByteLength: 8,
				elementByteLength: 8,
				endByteAddress: byteAddress + 4,
				endAddressSafeByteLength: 4,
			});
			expect(result.nextLocalAllocationUnitOffset).toBe(localAllocationUnitOffset + padding + 2);
			const following = planScalarDeclarationLayout({
				id: 'next',
				lineNumber: 2,
				instruction: 'int',
				startingByteAddress,
				localAllocationUnitOffset: result.nextLocalAllocationUnitOffset,
			});
			expect(following.declaration.byteAddress).toBe(byteAddress + 8);
		}
	);

	it.each(float64Starts.flatMap(start => [0, 1, 2].map(numberOfElements => ({ ...start, numberOfElements }))))(
		'keeps $numberOfElements-element float64 array bounds inside its storage at base $startingByteAddress and offset $localAllocationUnitOffset',
		({ startingByteAddress, localAllocationUnitOffset, byteAddress, padding, numberOfElements }) => {
			const result = planArrayDeclarationLayout({
				id: 'values',
				lineNumber: 1,
				instruction: 'float64[]',
				startingByteAddress,
				localAllocationUnitOffset,
				numberOfElements,
			});
			expect(result.declaration).toMatchObject({
				byteAddress,
				allocationUnitCount: padding + numberOfElements * 2,
				allocatedByteLength: numberOfElements * 8,
				elementByteLength: numberOfElements * 8,
				endByteAddress: numberOfElements === 0 ? byteAddress : byteAddress + numberOfElements * 8 - 4,
				endAddressSafeByteLength: numberOfElements === 0 ? 0 : 4,
			});
			expect(result.nextLocalAllocationUnitOffset).toBe(localAllocationUnitOffset + padding + numberOfElements * 2);
			const following = planScalarDeclarationLayout({
				id: 'next',
				lineNumber: 2,
				instruction: 'int',
				startingByteAddress,
				localAllocationUnitOffset: result.nextLocalAllocationUnitOffset,
			});
			expect(following.declaration.byteAddress).toBe(byteAddress + numberOfElements * 8);
		}
	);

	it.each([0, 1, 2])('marks a float64 array of length %i as a float64 value', numberOfElements => {
		const { declaration } = planArrayDeclarationLayout({
			id: 'doubles',
			lineNumber: 1,
			instruction: 'float64[]',
			numberOfElements,
			startingByteAddress: 8,
			localAllocationUnitOffset: 0,
		});

		expect(declaration).toMatchObject({
			isFloat64: true,
			isInteger: false,
			pointerDepth: 0,
			elementWordSize: 8,
		});
	});

	it.each([
		['float[]', false, 0, undefined],
		['int[]', true, 0, undefined],
		['float64*[]', true, 1, 'float64'],
		['float64**[]', true, 2, 'float64'],
	] as const)('keeps the existing value metadata for %s', (instruction, isInteger, pointerDepth, pointeeBaseType) => {
		const { declaration } = planArrayDeclarationLayout({
			id: 'values',
			lineNumber: 1,
			instruction,
			numberOfElements: 2,
			startingByteAddress: 8,
			localAllocationUnitOffset: 0,
		});

		expect(declaration).toMatchObject({ isInteger, pointerDepth, elementWordSize: 4 });
		expect(declaration.pointeeBaseType).toBe(pointeeBaseType);
		expect(declaration).not.toHaveProperty('isFloat64', true);
	});

	it('plans scalar declaration addresses on the 4-byte grid', () => {
		const result = planScalarDeclarationLayout({
			id: 'counter',
			lineNumber: 1,
			instruction: 'int',
			startingByteAddress: 4,
			localAllocationUnitOffset: 0,
		});

		expect(result).toEqual({
			declaration: {
				numberOfElements: 1,
				elementWordSize: 4,
				allocationUnitAddress: 1,
				allocationUnitCount: 1,
				allocatedByteLength: 4,
				byteAddress: 4,
				elementByteLength: 4,
				endByteAddress: 4,
				endAddressSafeByteLength: 4,
				id: 'counter',
				lineNumber: 1,
				type: 'int',
				pointerDepth: 0,
				isInteger: true,
				isUnsigned: false,
			},
			nextLocalAllocationUnitOffset: 1,
		});
	});

	it('adds alignment padding before scalar float64 declarations at odd allocation-unit offsets', () => {
		const result = planScalarDeclarationLayout({
			id: 'phase',
			lineNumber: 2,
			instruction: 'float64',
			startingByteAddress: 4,
			localAllocationUnitOffset: 0,
		});

		expect(result.declaration.allocationUnitAddress).toBe(2);
		expect(result.declaration.byteAddress).toBe(8);
		expect(result.declaration.allocationUnitCount).toBe(3);
		expect(result.nextLocalAllocationUnitOffset).toBe(3);
	});

	it('plans narrow arrays using byte width rounded to the allocation grid', () => {
		const result = planArrayDeclarationLayout({
			id: 'bytes',
			lineNumber: 3,
			instruction: 'int8[]',
			numberOfElements: 5,
			startingByteAddress: 4,
			localAllocationUnitOffset: 0,
		});

		expect(result.declaration).toMatchObject({
			numberOfElements: 5,
			elementWordSize: 1,
			allocationUnitAddress: 1,
			allocationUnitCount: 2,
			byteAddress: 4,
			id: 'bytes',
			lineNumber: 3,
			type: 'int8',
			pointerDepth: 0,
			isInteger: true,
			isUnsigned: false,
		});
		expect(result.nextLocalAllocationUnitOffset).toBe(2);
	});

	it.each([
		['int8[]', 4, 1, 1],
		['int16[]', 3, 2, 2],
		['float[]', 1, 4, 1],
		['float64[]', 1, 8, 2],
	] as const)(
		'keeps %s element widths separate from allocation-unit counts',
		(instruction, numberOfElements, elementWordSize, allocationUnitCount) => {
			const result = planArrayDeclarationLayout({
				id: 'values',
				lineNumber: 1,
				instruction,
				numberOfElements,
				startingByteAddress: 8,
				localAllocationUnitOffset: 0,
			});

			expect(result.declaration).toMatchObject({
				allocationUnitAddress: 2,
				allocationUnitCount,
				allocatedByteLength: allocationUnitCount * 4,
				byteAddress: 8,
				elementWordSize,
				elementByteLength: numberOfElements * elementWordSize,
			});
			expect(result.nextLocalAllocationUnitOffset).toBe(allocationUnitCount);
		}
	);

	it('aligns float64 arrays to 8-byte boundaries', () => {
		const result = planArrayDeclarationLayout({
			id: 'doubles',
			lineNumber: 4,
			instruction: 'float64[]',
			numberOfElements: 2,
			startingByteAddress: 4,
			localAllocationUnitOffset: 0,
		});

		expect(result.declaration.allocationUnitAddress).toBe(2);
		expect(result.declaration.byteAddress).toBe(8);
		expect(result.declaration.allocationUnitCount).toBe(5);
		expect(result.nextLocalAllocationUnitOffset).toBe(5);
	});
});
