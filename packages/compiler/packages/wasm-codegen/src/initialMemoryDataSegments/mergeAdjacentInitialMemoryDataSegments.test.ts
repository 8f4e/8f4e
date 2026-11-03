import { describe, expect, test } from 'vitest';
import { serializeSegments } from '../../tests/initialMemoryDataSegments/testUtils';
import mergeAdjacentInitialMemoryDataSegments from './mergeAdjacentInitialMemoryDataSegments';

describe('mergeAdjacentInitialMemoryDataSegments', () => {
	test('sorts segments and merges adjacent ranges with small zero gaps', () => {
		const segments = mergeAdjacentInitialMemoryDataSegments([
			{ byteAddress: 8, bytes: new Uint8Array([3]) },
			{ byteAddress: 0, bytes: new Uint8Array([1, 2]) },
			{ byteAddress: 2, bytes: new Uint8Array([4]) },
		]);

		expect(serializeSegments(segments)).toEqual([
			{
				byteAddress: 0,
				bytes: [1, 2, 4, 0, 0, 0, 0, 0, 3],
			},
		]);
	});

	test('merges across zero gaps up to 32 bytes', () => {
		const segments = mergeAdjacentInitialMemoryDataSegments([
			{ byteAddress: 0, bytes: new Uint8Array([1]) },
			{ byteAddress: 33, bytes: new Uint8Array([2]) },
		]);

		expect(serializeSegments(segments)).toEqual([
			{
				byteAddress: 0,
				bytes: [1, ...new Array(32).fill(0), 2],
			},
		]);
	});

	test('keeps ranges separate when the zero gap is larger than 32 bytes', () => {
		const segments = mergeAdjacentInitialMemoryDataSegments([
			{ byteAddress: 0, bytes: new Uint8Array([1]) },
			{ byteAddress: 34, bytes: new Uint8Array([2]) },
		]);

		expect(serializeSegments(segments)).toEqual([
			{
				byteAddress: 0,
				bytes: [1],
			},
			{
				byteAddress: 34,
				bytes: [2],
			},
		]);
	});

	test('copies segment bytes so callers cannot mutate retained inputs', () => {
		const inputBytes = new Uint8Array([1]);
		const [segment] = mergeAdjacentInitialMemoryDataSegments([{ byteAddress: 0, bytes: inputBytes }]);

		inputBytes[0] = 2;

		expect(Array.from(segment.bytes)).toEqual([1]);
	});
});
