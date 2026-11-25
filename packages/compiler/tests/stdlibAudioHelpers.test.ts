import { beforeAll, describe, expect, test } from 'vitest';

import { getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

type TptStep = (input: number, g: number, damping: number, s1: number, s2: number) => [number, number, number];
type BiquadStep = (
	input: number,
	b0: number,
	b1: number,
	b2: number,
	a1: number,
	a2: number,
	x1: number,
	x2: number,
	y1: number,
	y2: number
) => number;

let hzToRadians: (frequencyHz: number, sampleRate: number) => number;
let tptLowPass: TptStep;
let biquad: BiquadStep;

beforeAll(async () => {
	const { instance } = await instantiateFixtureProgramSource(`8f4e/v1
includes
include std/audio/biquad
include std/audio/hzToRadians
include std/audio/tptLowPass
includesEnd

function radians
#export
param float frequencyHz
param int sampleRate
call hzToRadians frequencyHz sampleRate
functionEnd float

function step
#export
param float input
param float g
param float damping
param float s1
param float s2
call tptLowPass input g damping s1 s2
functionEnd float float float

function biquadStep
#export
param float input
param float b0
param float b1
param float b2
param float a1
param float a2
param float x1
param float x2
param float y1
param float y2
call biquad input b0 b1 b2 a1 a2 x1 x2 y1 y2
functionEnd float
`);
	hzToRadians = getExportedFunction(instance.exports, 'radians') as typeof hzToRadians;
	tptLowPass = getExportedFunction(instance.exports, 'step') as TptStep;
	biquad = getExportedFunction(instance.exports, 'biquadStep') as BiquadStep;
});

describe('audio stdlib helpers', () => {
	test('processes FIR and recursive impulse responses from supplied coefficients', () => {
		let x1 = 0;
		let x2 = 0;
		const fir: number[] = [];
		for (let sample = 0; sample < 6; sample++) {
			const input = sample === 0 ? 1 : 0;
			fir.push(biquad(input, 0.25, 0.5, 0.25, 0, 0, x1, x2, 0, 0));
			x2 = x1;
			x1 = input;
		}
		expect(fir).toEqual([0.25, 0.5, 0.25, 0, 0, 0]);

		let previousOutput = 0;
		for (let sample = 0; sample < 16; sample++) {
			previousOutput = biquad(sample === 0 ? 1 : 0, 0.5, 0, 0, -0.5, 0, 0, 0, previousOutput, 0);
			expect(previousOutput).toBe(2 ** (-sample - 1));
		}
	});

	test('has no hidden biquad history between callers', () => {
		const first = biquad(1, 0.25, 0.5, 0.25, -0.5, 0.25, 0.125, -0.25, 0.5, -1);
		biquad(-1, 1, 2, 3, 4, 5, 6, 7, 8, 9);
		expect(biquad(1, 0.25, 0.5, 0.25, -0.5, 0.25, 0.125, -0.25, 0.5, -1)).toBe(first);
	});

	test('supports low-pass, high-pass and notch responses with normalized coefficients', () => {
		const sampleRate = 48000;
		const cutoff = 1000;
		const q = Math.SQRT1_2;
		const omega = (2 * Math.PI * cutoff) / sampleRate;
		const cosine = Math.cos(omega);
		const alpha = Math.sin(omega) / (2 * q);
		const a0 = 1 + alpha;
		const a1 = (-2 * cosine) / a0;
		const a2 = (1 - alpha) / a0;
		const responses = [
			{ numerator: [(1 - cosine) / 2, 1 - cosine, (1 - cosine) / 2], magnitude: (_ratio: number) => 1 },
			{ numerator: [(1 + cosine) / 2, -(1 + cosine), (1 + cosine) / 2], magnitude: (ratio: number) => ratio ** 2 },
			{ numerator: [1, -2 * cosine, 1], magnitude: (ratio: number) => Math.abs(1 - ratio ** 2) },
		];
		for (const { numerator, magnitude } of responses) {
			const [b0, b1, b2] = numerator.map(value => value / a0);
			for (const frequency of [250, 1000, 4000]) {
				let x1 = 0;
				let x2 = 0;
				let y1 = 0;
				let y2 = 0;
				let inputEnergy = 0;
				let outputEnergy = 0;
				const warmup = (64 * sampleRate) / cutoff;
				const samples = (32 * sampleRate) / frequency;
				for (let sample = 0; sample < warmup + samples; sample++) {
					const input = Math.sin((2 * Math.PI * frequency * sample) / sampleRate);
					const output = biquad(input, b0, b1, b2, a1, a2, x1, x2, y1, y2);
					x2 = x1;
					x1 = input;
					y2 = y1;
					y1 = output;
					if (sample >= warmup) {
						inputEnergy += input * input;
						outputEnergy += output * output;
					}
				}
				const ratio = Math.tan((Math.PI * frequency) / sampleRate) / Math.tan(omega / 2);
				const expected = magnitude(ratio) / Math.hypot(1 - ratio ** 2, ratio / q);
				expect(Math.abs(Math.sqrt(outputEnergy / inputEnergy) - expected)).toBeLessThan(2e-5);
			}
		}
	});

	test('converts signed Hz at different sample rates without reading environment constants', () => {
		for (const sampleRate of [32000, 44100, 48000, 96000]) {
			for (const frequency of [0, -1000, 440, 1000, sampleRate / 2]) {
				const expected = (2 * Math.PI * frequency) / sampleRate;
				expect(Math.abs(hzToRadians(frequency, sampleRate) - expected)).toBeLessThan(2e-7 * Math.abs(expected) + 1e-7);
			}
		}
	});

	test('keeps filter histories independent when callers pass their own state', () => {
		const first = tptLowPass(1, 0.25, 0.5, 0, 0);
		tptLowPass(-1, 0.5, 2, 0.125, -0.25);
		expect(tptLowPass(1, 0.25, 0.5, 0, 0)).toEqual(first);
		expect(tptLowPass(1, 0, 2, 0.125, 0.25)).toEqual([0.25, 0.125, 0.25]);
	});

	test('stays finite and settles to unity DC gain across frequency and damping ranges', () => {
		for (const g of [0.003, 0.1, 1, 10]) {
			for (const damping of [0.1, 1, 2]) {
				let s1 = 0;
				let s2 = 0;
				let output = 0;
				let finite = true;
				for (let sample = 0; sample < 48000; sample++) {
					[output, s1, s2] = tptLowPass(1, g, damping, s1, s2);
					finite &&= Number.isFinite(output) && Number.isFinite(s1) && Number.isFinite(s2);
				}
				expect(finite).toBe(true);
				expect(Math.abs(output - 1)).toBeLessThan(2e-4);
				expect(Math.abs(s1)).toBeLessThan(2e-4);
			}
		}
	});

	test('matches the analytic low-pass magnitude below, at and above cutoff', () => {
		const sampleRate = 48000;
		const cutoff = 1000;
		const g = Math.tan(hzToRadians(cutoff, sampleRate) / 2);
		const warmup = (64 * sampleRate) / cutoff;
		for (const damping of [0.1, Math.SQRT2, 2]) {
			for (const frequency of [250, 1000, 4000]) {
				const samples = (32 * sampleRate) / frequency;
				let s1 = 0;
				let s2 = 0;
				let inputEnergy = 0;
				let outputEnergy = 0;
				for (let sample = 0; sample < warmup + samples; sample++) {
					const input = Math.sin((2 * Math.PI * frequency * sample) / sampleRate);
					let output: number;
					[output, s1, s2] = tptLowPass(input, g, damping, s1, s2);
					if (sample >= warmup) {
						inputEnergy += input * input;
						outputEnergy += output * output;
					}
				}
				const ratio = Math.tan((Math.PI * frequency) / sampleRate) / g;
				const expected = 1 / Math.hypot(1 - ratio * ratio, damping * ratio);
				const actual = Math.sqrt(outputEnergy / inputEnergy);
				expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-4);
			}
		}
	});
});
