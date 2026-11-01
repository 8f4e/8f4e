import { describe, expect, test, vi } from 'vitest';
import { createMemory, createMemoryDefault, serializeSegments } from '../../tests/initialMemoryDataSegments/testUtils';
import createMemoryDataSegmentCandidate from './createMemoryDataSegmentCandidate';

function trackDataViewAllocations() {
	const NativeDataView = globalThis.DataView;
	const allocations: DataView[] = [];
	vi.stubGlobal(
		'DataView',
		class extends NativeDataView<ArrayBufferLike> {
			constructor(...args: ConstructorParameters<typeof DataView>) {
				super(...args);
				allocations.push(this);
			}
		}
	);
	return allocations;
}

describe('createMemoryDataSegmentCandidate', () => {
	test.each([
		['int32', {}, 7, [7, 0, 0, 0]],
		['int8', { elementWordSize: 1 }, -7, [249]],
		['int8u', { elementWordSize: 1, isUnsigned: true }, 249, [249]],
		['int16', { elementWordSize: 2 }, -12345, [199, 207]],
		['int16u', { elementWordSize: 2, isUnsigned: true }, 54321, [49, 212]],
		['float32', { type: 'float', isInteger: false }, 1.25, [0, 0, 160, 63]],
		['float64', { type: 'float64', isInteger: false, elementWordSize: 8 }, 1.25, [0, 0, 0, 0, 0, 0, 244, 63]],
		['float32 negative zero', { type: 'float', isInteger: false }, -0, [0, 0, 0, 128]],
		[
			'float64 negative zero',
			{ type: 'float64', isInteger: false, elementWordSize: 8 },
			-0,
			[0, 0, 0, 0, 0, 0, 0, 128],
		],
	] as const)('encodes a one-element %s array initializer', (_name, overrides, value, bytes) => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({ id: 'array', byteAddress: 16, ...overrides }),
			createMemoryDefault({ 0: value }, { hasExplicitDefault: true })
		);

		expect(candidates).toEqual([{ byteAddress: 16, bytes: new Uint8Array(bytes), sourceKind: 'array' }]);
	});

	test('skips omitted and explicit zero initializers for one-element arrays', () => {
		const memory = createMemory({ id: 'array', byteAddress: 16 });

		expect(createMemoryDataSegmentCandidate(memory, createMemoryDefault({}))).toEqual([]);
		expect(
			createMemoryDataSegmentCandidate(memory, createMemoryDefault({ 0: 0 }, { hasExplicitDefault: true }))
		).toEqual([]);
	});

	test('creates scalar candidates with encoded default bytes', () => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({
				id: 'scalar',
				byteAddress: 12,
			}),
			createMemoryDefault(2.9)
		);
		const [candidate] = candidates;

		expect(candidate?.byteAddress).toBe(12);
		expect(candidate?.sourceKind).toBe('scalar');
		expect(Array.from(candidate?.bytes ?? [])).toEqual([2, 0, 0, 0]);
	});

	test('creates explicit array candidates only for non-zero initializer runs', () => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({
				id: 'array',
				byteAddress: 16,
				numberOfElements: 4,
			}),
			createMemoryDefault(
				{
					0: 1,
					1: 2,
					2: 0,
					3: 4,
				},
				{ hasExplicitDefault: true }
			)
		);

		expect(
			candidates.map(candidate => ({
				byteAddress: candidate.byteAddress,
				bytes: Array.from(candidate.bytes),
				sourceKind: candidate.sourceKind,
			}))
		).toEqual([
			{
				byteAddress: 16,
				bytes: [1, 0, 0, 0, 2, 0, 0, 0],
				sourceKind: 'array',
			},
			{
				byteAddress: 28,
				bytes: [4, 0, 0, 0],
				sourceKind: 'array',
			},
		]);
	});

	test('does not create a full byte image for large sparse array initializers', () => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({
				id: 'array',
				byteAddress: 16,
				numberOfElements: 1_000_000,
			}),
			createMemoryDefault(
				{
					0: 1,
				},
				{ hasExplicitDefault: true }
			)
		);

		expect(candidates).toHaveLength(1);
		expect(candidates[0].byteAddress).toBe(16);
		expect(Array.from(candidates[0].bytes)).toEqual([1, 0, 0, 0]);
	});

	test('skips implicit zero-filled arrays', () => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({
				id: 'array',
				byteAddress: 16,
				numberOfElements: 3,
			}),
			createMemoryDefault({})
		);

		expect(candidates).toEqual([]);
	});

	test('skips implicit zero scalar candidates', () => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({
				id: 'scalar',
				byteAddress: 12,
			}),
			createMemoryDefault(0)
		);

		expect(candidates).toEqual([]);
	});

	test('creates explicit zero scalar candidates', () => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({
				id: 'scalar',
				byteAddress: 12,
			}),
			createMemoryDefault(0, { hasExplicitDefault: true })
		);
		const [candidate] = candidates;

		expect(candidate?.byteAddress).toBe(12);
		expect(candidate?.sourceKind).toBe('scalar');
		expect(Array.from(candidate?.bytes ?? [])).toEqual([0, 0, 0, 0]);
	});

	test('skips explicit zero-filled array candidates', () => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({
				id: 'array',
				byteAddress: 16,
				numberOfElements: 3,
			}),
			createMemoryDefault(
				{
					0: 0,
				},
				{ hasExplicitDefault: true }
			)
		);

		expect(candidates).toEqual([]);
	});

	test.each([
		{ name: 'int8', elementWordSize: 1, isInteger: true, isUnsigned: false },
		{ name: 'uint8', elementWordSize: 1, isInteger: true, isUnsigned: true },
		{ name: 'int16', elementWordSize: 2, isInteger: true, isUnsigned: false },
		{ name: 'uint16', elementWordSize: 2, isInteger: true, isUnsigned: true },
		{ name: 'int32', elementWordSize: 4, isInteger: true, isUnsigned: false },
		{ name: 'uint32', elementWordSize: 4, isInteger: true, isUnsigned: true },
		{ name: 'float32', elementWordSize: 4, isInteger: false, isUnsigned: false },
		{ name: 'float64', elementWordSize: 8, isInteger: false, isUnsigned: false },
	])('does not allocate byte views for positive-zero $name arrays', format => {
		const allocations = trackDataViewAllocations();
		try {
			const candidates = createMemoryDataSegmentCandidate(
				createMemory({
					id: 'array',
					byteAddress: 16,
					numberOfElements: 3,
					elementWordSize: format.elementWordSize,
					isInteger: format.isInteger,
					isUnsigned: format.isUnsigned,
				}),
				createMemoryDefault({ 0: 0, 1: 0, 2: 0 }, { hasExplicitDefault: true })
			);

			expect(candidates).toEqual([]);
			expect(allocations).toHaveLength(0);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	test('skips positive-zero buffers while preserving runs and sparse gaps', () => {
		const allocations = trackDataViewAllocations();
		try {
			const candidates = createMemoryDataSegmentCandidate(
				createMemory({ id: 'array', byteAddress: 16, numberOfElements: 9 }),
				createMemoryDefault({ 0: 0, 1: 1, 2: 2, 3: 0, 5: 3, 6: 0, 7: 4, 8: 0 }, { hasExplicitDefault: true })
			);

			expect(serializeSegments(candidates)).toEqual([
				{ byteAddress: 20, bytes: [1, 0, 0, 0, 2, 0, 0, 0] },
				{ byteAddress: 36, bytes: [3, 0, 0, 0] },
				{ byteAddress: 44, bytes: [4, 0, 0, 0] },
			]);
			expect(allocations).toHaveLength(4);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	test.each([
		{ name: 'float32 negative zero', elementWordSize: 4, value: -0, byteAddress: 20, bytes: [0, 0, 0, 128] },
		{
			name: 'float64 negative zero',
			elementWordSize: 8,
			value: -0,
			byteAddress: 24,
			bytes: [0, 0, 0, 0, 0, 0, 0, 128],
		},
		{ name: 'float32 negative underflow', elementWordSize: 4, value: -1e-50, byteAddress: 20, bytes: [0, 0, 0, 128] },
	])('preserves the sign bit of $name between positive zeros', ({ elementWordSize, value, byteAddress, bytes }) => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({ id: 'array', byteAddress: 16, numberOfElements: 3, isInteger: false, elementWordSize }),
			createMemoryDefault({ 0: 0, 1: value, 2: 0 }, { hasExplicitDefault: true })
		);

		expect(serializeSegments(candidates)).toEqual([{ byteAddress, bytes }]);
	});

	test.each([
		{
			name: 'float32 underflow',
			isInteger: false,
			isUnsigned: false,
			elementWordSize: 4,
			values: [1e-50, Number.MIN_VALUE],
			first: [0, 0, 128, 63],
			second: [0, 0, 0, 64],
			lastAddress: 24,
		},
		{
			name: 'int8 truncation and wrapping',
			isInteger: true,
			isUnsigned: false,
			elementWordSize: 1,
			values: [0.9, -0.9, 256, -256, -0],
			first: [1],
			second: [2],
			lastAddress: 18,
		},
		{
			name: 'uint16 truncation and wrapping',
			isInteger: true,
			isUnsigned: true,
			elementWordSize: 2,
			values: [0.9, -0.9, 65536, -65536, -0],
			first: [1, 0],
			second: [2, 0],
			lastAddress: 20,
		},
		{
			name: 'int32 truncation and wrapping',
			isInteger: true,
			isUnsigned: false,
			elementWordSize: 4,
			values: [0.9, -0.9, 4294967296, -4294967296, -0],
			first: [1, 0, 0, 0],
			second: [2, 0, 0, 0],
			lastAddress: 24,
		},
	])('still splits runs when $name encodes to zero', format => {
		for (const value of format.values) {
			const candidates = createMemoryDataSegmentCandidate(
				createMemory({
					id: 'array',
					byteAddress: 16,
					numberOfElements: 3,
					elementWordSize: format.elementWordSize,
					isInteger: format.isInteger,
					isUnsigned: format.isUnsigned,
				}),
				createMemoryDefault({ 0: 1, 1: value, 2: 2 }, { hasExplicitDefault: true })
			);

			expect(serializeSegments(candidates)).toEqual([
				{ byteAddress: 16, bytes: format.first },
				{ byteAddress: format.lastAddress, bytes: format.second },
			]);
		}
	});

	test.each([4, 8])('preserves NaN and infinities in %i-byte float arrays', elementWordSize => {
		const candidates = createMemoryDataSegmentCandidate(
			createMemory({ id: 'array', byteAddress: 16, numberOfElements: 4, isInteger: false, elementWordSize }),
			createMemoryDefault({ 0: -Infinity, 1: NaN, 2: Infinity, 3: 0 }, { hasExplicitDefault: true })
		);
		expect(candidates).toHaveLength(1);
		const [candidate] = candidates;
		expect(candidate.byteAddress).toBe(16);
		expect(candidate.bytes).toHaveLength(3 * elementWordSize);
		const view = new DataView(candidate.bytes.buffer, candidate.bytes.byteOffset, candidate.bytes.byteLength);
		const read = (offset: number) =>
			elementWordSize === 4 ? view.getFloat32(offset, true) : view.getFloat64(offset, true);
		expect(read(0)).toBe(-Infinity);
		expect(read(elementWordSize)).toBeNaN();
		expect(read(2 * elementWordSize)).toBe(Infinity);
	});
});
