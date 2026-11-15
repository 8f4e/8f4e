import { describe, expect, test } from 'vitest';
import { loadExample, nextFloat32, withProbe } from './exampleRuntime';

function thresholds(first: number, ratio: number, count: number): number[] {
	const result: number[] = [];
	let boundary = Math.fround(first);
	for (let key = 0; key < count; key++) {
		result.push(boundary);
		boundary = Math.fround(boundary * Math.fround(ratio));
	}
	return result;
}

describe('DX7 frequency-to-key behavior', () => {
	test.each(['audio/dx7Algorithm5.8f4e', 'midi/dx7Algorithm5EightVoices.8f4e'])(
		'%s preserves every float32 note and rate boundary',
		async path => {
			const runtime = await loadExample(
				path,
				source =>
					withProbe(
						withProbe(source, 'frequencyToKey', ['float frequency'], 'int'),
						'frequencyToRateKey',
						['float frequency'],
						'int'
					),
				0,
				'frequencyToKey'
			);
			for (const [fn, boundaries] of [
				['probeFrequencyToKey', thresholds(8.4153681102195, 1.0594630943592953, 127)],
				['probeFrequencyToRateKey', thresholds(31.7721991639875, 1.189207115002721, 31)],
			] as const) {
				const values = [-3.4028234663852886e38, -440, -0, 0, 2 ** -149, 3.4028234663852886e38];
				for (const boundary of boundaries) values.push(nextFloat32(boundary, -1), boundary, nextFloat32(boundary, 1));
				for (let i = 0; i <= 4096; i++) values.push(Math.fround(2 ** (-149 + (i * 276) / 4096)));
				for (const value of values) {
					const frequency = Math.fround(value);
					const expected = boundaries.findIndex(boundary => frequency < boundary);
					expect(runtime.call(fn, frequency), fn + ' at ' + frequency).toBe(
						expected === -1 ? boundaries.length : expected
					);
				}
			}
		}
	);
});
