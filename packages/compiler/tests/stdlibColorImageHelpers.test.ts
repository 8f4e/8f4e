import { beforeAll, describe, expect, test } from 'vitest';

import { getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

let exports: WebAssembly.Exports;
let memory: WebAssembly.Memory;

beforeAll(async () => {
	const program = await instantiateFixtureProgramSource(`8f4e/v1
includes
include std/math/log2
include std/math/exp2
include std/math/lerp
include std/color/srgbByteToLinear
include std/color/linearToSrgbByte
include std/image/downsampleRGB2x
includesEnd
function decode
#export
param int channel
call srgbByteToLinear channel
functionEnd float
function encode
#export
param float value
call linearToSrgbByte value
functionEnd int
function downsample
#export
#impure
param int8u* source
param int8u* destination
param int outputWidth
param int outputHeight
param int sourceStride
param int destinationStride
param float amount
call downsampleRGB2x source destination outputWidth outputHeight sourceStride destinationStride amount
functionEnd
`);
	exports = program.instance.exports;
	memory = program.host.memory as WebAssembly.Memory;
});

function evaluate(name: string, ...args: number[]): number {
	return getExportedFunction(exports, name)(...args) as number;
}

function linear(byte: number): number {
	const encoded = byte / 255;
	return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
}

function encoded(value: number): number {
	const clamped = Math.min(1, Math.max(0, value));
	const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
	return Math.round(encoded * 255);
}

interface DownsampleCase {
	outputWidth: number;
	outputHeight: number;
	sourcePadding: number;
	destinationPadding: number;
	sourceAlignment: number;
	destinationAlignment: number;
	amount: number;
}

const outputSizes = [1, 3, 7].flatMap(outputWidth => [1, 2, 4].map(outputHeight => ({ outputWidth, outputHeight })));
const bufferLayouts = [
	...[0, 5].flatMap(padding =>
		[0, 1, 3].map(alignment => ({
			sourcePadding: padding,
			destinationPadding: padding,
			sourceAlignment: alignment,
			destinationAlignment: alignment,
		}))
	),
	{ sourcePadding: 0, destinationPadding: 5, sourceAlignment: 1, destinationAlignment: 3 },
	{ sourcePadding: 5, destinationPadding: 0, sourceAlignment: 3, destinationAlignment: 1 },
	{ sourcePadding: 2, destinationPadding: 7, sourceAlignment: 0, destinationAlignment: 1 },
];
const downsampleCases: DownsampleCase[] = outputSizes.flatMap(size =>
	bufferLayouts.flatMap(layout => [0, 0.37, 1].map(amount => ({ ...size, ...layout, amount })))
);

function createDownsampleFixture(testCase: DownsampleCase) {
	const { outputWidth, outputHeight, sourcePadding, destinationPadding, sourceAlignment, destinationAlignment } =
		testCase;
	const bytes = new Uint8Array(memory.buffer);
	const source = 64 + sourceAlignment;
	const destination = 8192 + destinationAlignment;
	const sourceStride = outputWidth * 6 + sourcePadding;
	const destinationStride = outputWidth * 3 + destinationPadding;
	bytes.fill(0xa5);
	for (let y = 0; y < outputHeight * 2; y++) {
		for (let x = 0; x < outputWidth * 2; x++) {
			for (let channel = 0; channel < 3; channel++) {
				bytes[source + y * sourceStride + x * 3 + channel] = (x * 53 + y * 17 + channel * 71) & 255;
			}
		}
	}
	return { ...testCase, bytes, source, destination, sourceStride, destinationStride, original: bytes.slice() };
}

function expectDownsampledImage(fixture: ReturnType<typeof createDownsampleFixture>) {
	const { bytes, original, source, destination, sourceStride, destinationStride, outputWidth, outputHeight } = fixture;
	const expected = original.slice();
	const outputMask = new Uint8Array(bytes.length);
	const amount = Math.fround(fixture.amount);
	for (let y = 0; y < outputHeight; y++) {
		for (let x = 0; x < outputWidth; x++) {
			for (let channel = 0; channel < 3; channel++) {
				const first = source + 2 * y * sourceStride + 6 * x + channel;
				const neighbors = [first, first + 3, first + sourceStride, first + sourceStride + 3];
				const average = neighbors.reduce((sum, address) => sum + linear(original[address]), 0) / 4;
				const output = destination + y * destinationStride + x * 3 + channel;
				expected[output] =
					amount === 0 ? original[first] : encoded(linear(original[first]) * (1 - amount) + average * amount);
				outputMask[output] = 1;
			}
		}
	}
	const tolerance = amount === 0 ? 0 : 1;
	expect(
		bytes.findIndex((value, index) =>
			outputMask[index] ? Math.abs(value - expected[index]) > tolerance : value !== expected[index]
		)
	).toBe(-1);
}

describe('color and image stdlib helpers', () => {
	test('all sRGB bytes round-trip exactly and decode within the measured error bound', () => {
		let maximumError = 0;
		let previous = -Infinity;
		for (let channel = 0; channel < 256; channel++) {
			const actual = evaluate('decode', channel);
			expect(evaluate('encode', actual)).toBe(channel);
			expect(actual).toBeGreaterThanOrEqual(previous);
			previous = actual;
			maximumError = Math.max(maximumError, Math.abs(actual - linear(channel)));
		}
		expect(maximumError).toBeLessThan(1e-6);
	});

	test('linear encoding is monotonic and within one byte level across a dense sweep', () => {
		let previous = -1;
		let maximumError = 0;
		for (let i = 0; i <= 65536; i++) {
			const value = Math.fround(i / 65536);
			const actual = evaluate('encode', value);
			expect(actual).toBeGreaterThanOrEqual(previous);
			previous = actual;
			maximumError = Math.max(maximumError, Math.abs(actual - encoded(value)));
		}
		expect(maximumError).toBeLessThanOrEqual(1);
	});

	test('encoding covers the transfer boundary, subnormals, and finite clamped values', () => {
		for (const value of [0.0031307, 0.0031308, 0.0031309, 2 ** -149, -(2 ** -149), -1, 2, -(2 ** 127), 2 ** 127]) {
			const input = Math.fround(value);
			expect(Math.abs(evaluate('encode', input) - encoded(input))).toBeLessThanOrEqual(1);
		}
		expect(evaluate('encode', -1)).toBe(0);
		expect(evaluate('encode', 2)).toBe(255);
	});

	test.each(downsampleCases)(
		'downsamples $outputWidth x $outputHeight, padding $sourcePadding/$destinationPadding, alignment $sourceAlignment/$destinationAlignment, amount $amount',
		testCase => {
			const fixture = createDownsampleFixture(testCase);
			evaluate(
				'downsample',
				fixture.source,
				fixture.destination,
				testCase.outputWidth,
				testCase.outputHeight,
				fixture.sourceStride,
				fixture.destinationStride,
				testCase.amount
			);
			expectDownsampledImage(fixture);
		}
	);

	test('zero-sized outputs leave the complete memory unchanged', () => {
		const bytes = new Uint8Array(memory.buffer);
		bytes.fill(0x5a);
		const expected = bytes.slice();
		for (const [outputWidth, outputHeight] of [
			[0, 4],
			[4, 0],
			[0, 0],
		]) {
			evaluate(
				'downsample',
				bytes.length - 1,
				bytes.length - 1,
				outputWidth,
				outputHeight,
				outputWidth * 6,
				outputWidth * 3,
				1
			);
			expect(bytes).toEqual(expected);
		}
	});
});
