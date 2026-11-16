import { describe, expect, it } from 'vitest';
import { createWaveformPeaks, MAX_WAVEFORM_SAMPLE_READS, updateWaveformPeaks } from './peaks';

describe('progressive waveform peaks', () => {
	it('bounds reads for a huge buffer while sampling every display column', () => {
		const length = 100_000_003;
		let reads = 0;
		const samples = new Proxy(
			{ length },
			{
				get(target, property) {
					if (property === 'length') return target.length;
					if (++reads > MAX_WAVEFORM_SAMPLE_READS) throw new Error('Sample read budget exceeded');
					return 0.25;
				},
			}
		);
		const peaks = createWaveformPeaks(128);
		updateWaveformPeaks(peaks, samples as unknown as ArrayLike<number>, 0, length);
		expect(reads).toBeGreaterThan(0);
		expect(reads).toBeLessThanOrEqual(MAX_WAVEFORM_SAMPLE_READS);
		expect([...peaks.minima]).toEqual(Array(128).fill(0.25));
		expect([...peaks.maxima]).toEqual(Array(128).fill(0.25));
	});

	it('visits every sample across frames, including isolated peaks between the initial reads', () => {
		const length = MAX_WAVEFORM_SAMPLE_READS * 3 + 17;
		const samples = new Int16Array(length);
		samples[1] = 32767;
		samples[length - 2] = -32768;
		const peaks = createWaveformPeaks(8);
		updateWaveformPeaks(peaks, samples, 0, length);
		expect(peaks.hasCompleteSweep).toBe(false);
		expect([...peaks.maxima]).toEqual(Array(8).fill(0));
		for (let frame = 0; frame < 3; frame++) updateWaveformPeaks(peaks, samples, 0, length);
		expect(peaks.hasCompleteSweep).toBe(true);
		expect(peaks.phase).toBe(0);
		expect([...peaks.minima]).toEqual([0, 0, 0, 0, 0, 0, 0, -32768]);
		expect([...peaks.maxima]).toEqual([32767, 0, 0, 0, 0, 0, 0, 0]);
	});

	it('refreshes changed live contents on the next sweep without detecting changes', () => {
		const length = MAX_WAVEFORM_SAMPLE_READS * 3 + 17;
		const samples = new Float32Array(length);
		samples[1] = 1;
		const peaks = createWaveformPeaks(8);
		for (let frame = 0; frame < 4; frame++) updateWaveformPeaks(peaks, samples, 0, length);
		samples[1] = 0;
		samples[length - 2] = -1;
		updateWaveformPeaks(peaks, samples, 0, length);
		expect(peaks.maxima[0]).toBe(1);
		for (let frame = 0; frame < 3; frame++) updateWaveformPeaks(peaks, samples, 0, length);
		expect([...peaks.maxima]).toEqual(Array(8).fill(0));
		expect(peaks.minima[7]).toBe(-1);
	});

	it('reads the current view, start and length without retaining the sample buffer', () => {
		const peaks = createWaveformPeaks(2);
		updateWaveformPeaks(peaks, new Int16Array([0, 1, 2, 3]), 0, 4);
		expect([...peaks.minima]).toEqual([0, 2]);
		updateWaveformPeaks(peaks, new Float64Array([100, 100, -0.5, 0.75]), 2, 2);
		expect([...peaks.minima]).toEqual([-0.5, 0.75]);
		expect([...peaks.maxima]).toEqual([-0.5, 0.75]);
	});

	it('handles a live count shrinking during a multi-frame sweep', () => {
		const length = MAX_WAVEFORM_SAMPLE_READS * 3 + 17;
		const peaks = createWaveformPeaks(8);
		const samples = new Int8Array(length);
		updateWaveformPeaks(peaks, samples, 0, length);
		samples.fill(42, 0, 8);
		updateWaveformPeaks(peaks, samples, 0, 8);
		expect(peaks.phase).toBe(0);
		expect([...peaks.minima]).toEqual(Array(8).fill(42));
		expect([...peaks.maxima]).toEqual(Array(8).fill(42));
	});
});
