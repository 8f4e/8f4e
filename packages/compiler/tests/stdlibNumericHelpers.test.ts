import { beforeAll, describe, expect, test } from 'vitest';

import { getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

let exports: WebAssembly.Exports;
let memory: WebAssembly.Memory;

beforeAll(async () => {
	const program = await instantiateFixtureProgramSource(`8f4e/v1
includes
include std/math/log2
include std/math/fract
include std/math/lerp
include std/math/smoothstep
include std/color/lerpRGB
include std/memory/storeRGB
includesEnd
${[
	['log32', 'log2', 'float'],
	['log64', 'log2', 'float64'],
	['fraction64', 'fract', 'float64'],
	['ease64', 'smoothstep', 'float64'],
]
	.map(
		([name, helper, type]) => `function ${name}
#export
param ${type} value
push value
call ${helper}
functionEnd ${type}`
	)
	.join('\n')}
function interpolate64
#export
param float64 start
param float64 end
param float64 amount
call lerp start end amount
functionEnd float64
${['float', 'float64']
	.map(
		(type, index) => `function color${index}
#export
param int start
param int end
param ${type} amount
call lerpRGB start end amount
functionEnd int`
	)
	.join('\n')}
function writeRGB
#export
#impure
param int8u* pixel
param int color
call storeRGB pixel color
functionEnd
`);
	exports = program.instance.exports;
	memory = program.host.memory as WebAssembly.Memory;
});

function evaluate(name: string, ...args: number[]): number {
	return getExportedFunction(exports, name)(...args) as number;
}

describe('extracted numeric stdlib helpers', () => {
	test('log2 covers float32 exponents and subnormals with bounded absolute error', () => {
		let maximumError = 0;
		for (let exponent = -149; exponent <= 127; exponent++) {
			expect(evaluate('log32', 2 ** exponent)).toBe(exponent);
			for (const mantissa of [1, 1.125, 1.5, 1.99999988]) {
				const value = Math.fround(2 ** exponent * mantissa);
				maximumError = Math.max(maximumError, Math.abs(evaluate('log32', value) - Math.log2(value)));
			}
		}
		let previous = -Infinity;
		for (let index = 0; index <= 8192; index++) {
			const value = Math.fround(1 + index / 8192);
			const actual = evaluate('log32', value);
			expect(actual).toBeGreaterThanOrEqual(previous);
			previous = actual;
			maximumError = Math.max(maximumError, Math.abs(actual - Math.log2(value)));
		}
		expect(maximumError).toBeLessThan(1e-5);
	});

	test('log2 covers float64 exponents, extreme finite inputs and subnormals', () => {
		let maximumError = 0;
		for (let exponent = -1074; exponent <= 1023; exponent++) {
			expect(evaluate('log64', 2 ** exponent)).toBe(exponent);
			for (const mantissa of [1, 1.125, 1.5, 1.9999999999999998]) {
				const value = 2 ** exponent * mantissa;
				maximumError = Math.max(maximumError, Math.abs(evaluate('log64', value) - Math.log2(value)));
			}
		}
		let previous = -Infinity;
		for (let index = 0; index <= 8192; index++) {
			const value = 1 + index / 8192;
			const actual = evaluate('log64', value);
			expect(actual).toBeGreaterThanOrEqual(previous);
			previous = actual;
			maximumError = Math.max(maximumError, Math.abs(actual - Math.log2(value)));
		}
		for (const value of [Number.MIN_VALUE, Number.MAX_VALUE, 1 - Number.EPSILON / 2, 1 + Number.EPSILON]) {
			maximumError = Math.max(maximumError, Math.abs(evaluate('log64', value) - Math.log2(value)));
		}
		expect(maximumError).toBeLessThan(1.6e-10);
	});

	test('double fract matches truncation, including huge integers and tiny signed fractions', () => {
		const values = [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE];
		for (let exponent = -1074; exponent <= 1023; exponent += 7) {
			for (const mantissa of [1, 1.125, 1.5, 1.9999999999999998]) {
				const value = 2 ** exponent * mantissa;
				values.push(value, -value);
			}
		}
		values.push(2147483648.75, -2147483649.25, 2 ** 51 + 0.5, -(2 ** 51 + 0.5));
		for (const value of values) expect(evaluate('fraction64', value)).toBe(value - Math.trunc(value));
	});

	test('double interpolation and easing retain precision below float32 resolution', () => {
		const start = 1 + 2 ** -50;
		const end = 1 + 2 ** -48;
		expect(evaluate('interpolate64', start, end, 0)).toBe(start);
		expect(evaluate('interpolate64', start, end, 1)).toBe(end);
		expect(evaluate('interpolate64', start, end, 0.5)).toBe((start + end) / 2);
		for (const amount of [1e-10, 0.25, 0.5, 0.75, 1 - 1e-10]) {
			expect(evaluate('ease64', amount)).toBe(amount * amount * (3 - 2 * amount));
		}
	});

	test('RGB interpolation matches channel arithmetic for both precision overloads', () => {
		let random = 0x71c0ffee;
		const next = () => {
			random ^= random << 13;
			random ^= random >>> 17;
			random ^= random << 5;
			return random >>> 0;
		};
		const f = Math.fround;
		const roundEven = (value: number) => {
			const lower = Math.floor(value);
			return value - lower === 0.5 ? lower + (lower & 1) : Math.round(value);
		};
		for (let index = 0; index < 2048; index++) {
			const start = next();
			const end = next();
			const amount = next() / 0xffffffff;
			for (const precision of [0, 1]) {
				let expected = 0;
				for (const shift of [0, 8, 16]) {
					const first = (start >>> shift) & 255;
					const second = (end >>> shift) & 255;
					const value = precision ? first + (second - first) * amount : f(first + f((second - first) * f(amount)));
					expected |= roundEven(value) << shift;
				}
				expect(evaluate(`color${precision}`, start, end, amount)).toBe(expected);
			}
		}
		expect(evaluate('color0', 0, 1, 0.5 + Number.EPSILON)).toBe(0);
		expect(evaluate('color1', 0, 1, 0.5 + Number.EPSILON)).toBe(1);
	});

	test('RGB stores write exactly three bytes at every address alignment', () => {
		const bytes = new Uint8Array(memory.buffer);
		for (let alignment = 0; alignment < 4; alignment++) {
			for (const color of [0, 0x123456, 0xffffff, 0xffabcdef, -1]) {
				bytes.fill(0xa5);
				const address = 16 + alignment;
				evaluate('writeRGB', address, color);
				expect([...bytes.slice(address, address + 3)]).toEqual([
					(color >>> 16) & 255,
					(color >>> 8) & 255,
					color & 255,
				]);
				expect(bytes.slice(0, address).every(value => value === 0xa5)).toBe(true);
				expect(bytes.slice(address + 3).every(value => value === 0xa5)).toBe(true);
			}
		}
	});
});
