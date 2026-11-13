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
param int width
param int height
param int sourceStride
param int destinationStride
param float amount
call downsampleRGB2x source destination width height sourceStride destinationStride amount
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

	test('downsampling handles independent byte strides and unaligned buffers without touching padding or source', () => {
		const bytes = new Uint8Array(memory.buffer);
		for (const width of [1, 3, 7])
			for (const height of [1, 2, 4]) {
				for (const padding of [0, 5])
					for (const alignment of [0, 1, 3])
						for (const amount of [0, 0.37, 1]) {
							const source = 64 + alignment,
								destination = 8192 + alignment;
							const sourceStride = width * 6 + padding,
								destinationStride = width * 3 + padding;
							bytes.fill(0xa5);
							for (let y = 0; y < height * 2; y++)
								for (let x = 0; x < width * 2; x++) {
									for (let c = 0; c < 3; c++)
										bytes[source + y * sourceStride + x * 3 + c] = (x * 53 + y * 17 + c * 71) & 255;
								}
							const expected = bytes.slice();
							const outputMask = new Uint8Array(bytes.length);
							const a = Math.fround(amount);
							for (let y = 0; y < height; y++)
								for (let x = 0; x < width; x++)
									for (let c = 0; c < 3; c++) {
										const first = source + 2 * y * sourceStride + 6 * x + c;
										const neighbors = [first, first + 3, first + sourceStride, first + sourceStride + 3];
										const average = neighbors.reduce((sum, address) => sum + linear(bytes[address]), 0) / 4;
										const output = destination + y * destinationStride + x * 3 + c;
										expected[output] = a === 0 ? bytes[first] : encoded(linear(bytes[first]) * (1 - a) + average * a);
										outputMask[output] = 1;
									}
							evaluate('downsample', source, destination, width, height, sourceStride, destinationStride, a);
							expect(
								bytes.findIndex((value, i) =>
									outputMask[i] ? Math.abs(value - expected[i]) > 1 : value !== expected[i]
								),
								`${width}x${height}, padding ${padding}, alignment ${alignment}, amount ${a}`
							).toBe(-1);
						}
			}
	});

	test('zero-sized outputs leave the complete memory unchanged', () => {
		const bytes = new Uint8Array(memory.buffer);
		bytes.fill(0x5a);
		const expected = bytes.slice();
		for (const [width, height] of [
			[0, 4],
			[4, 0],
			[0, 0],
		]) {
			evaluate('downsample', bytes.length - 1, bytes.length - 1, width, height, width * 6, width * 3, 1);
			expect(bytes).toEqual(expected);
		}
	});
});
