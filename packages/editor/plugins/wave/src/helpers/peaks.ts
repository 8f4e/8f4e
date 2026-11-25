/** Maximum sample reads per waveform and draw, independent of the buffer's length. */
export const MAX_WAVEFORM_SAMPLE_READS = 262144;

/** Per-column extrema and the progress of a bounded scan through the current live buffer. */
export interface WaveformPeaks {
	phase: number;
	hasCompleteSweep: boolean;
	minima: Float64Array;
	maxima: Float64Array;
	pendingMinima: Float64Array;
	pendingMaxima: Float64Array;
}

/** Allocates only display-column summaries; sample contents are always read from live memory. */
export function createWaveformPeaks(columnCount: number): WaveformPeaks {
	const count = Math.min(MAX_WAVEFORM_SAMPLE_READS, columnCount);
	return {
		phase: 0,
		hasCompleteSweep: false,
		minima: new Float64Array(count),
		maxima: new Float64Array(count),
		pendingMinima: new Float64Array(count),
		pendingMaxima: new Float64Array(count),
	};
}

/**
 * Reads at most MAX_WAVEFORM_SAMPLE_READS samples, spread across every display column.
 * Successive phases visit every sample, preserving isolated peaks without a full-buffer draw.
 * The sample count must be a positive integer.
 */
export function updateWaveformPeaks(
	peaks: WaveformPeaks,
	samples: ArrayLike<number>,
	baseIndex: number,
	arrayLength: number
): void {
	const columnCount = peaks.minima.length;
	const readsPerColumn = Math.floor(MAX_WAVEFORM_SAMPLE_READS / columnCount);
	const stride = Math.ceil(Math.ceil(arrayLength / columnCount) / readsPerColumn);
	peaks.phase %= stride;
	if (peaks.phase === 0) {
		peaks.pendingMinima.fill(Number.POSITIVE_INFINITY);
		peaks.pendingMaxima.fill(Number.NEGATIVE_INFINITY);
	}
	for (let column = 0; column < columnCount; column++) {
		const start = Math.floor((column / columnCount) * arrayLength);
		const end = Math.max(start + 1, Math.floor(((column + 1) / columnCount) * arrayLength));
		let min = peaks.pendingMinima[column];
		let max = peaks.pendingMaxima[column];
		for (let index = start + peaks.phase; index < end; index += stride) {
			const value = samples[baseIndex + index];
			min = Math.min(min, value);
			max = Math.max(max, value);
		}
		peaks.pendingMinima[column] = min;
		peaks.pendingMaxima[column] = max;
	}

	peaks.phase++;
	const complete = peaks.phase === stride;
	// Refine the initial overview; retain the last complete sweep during later refreshes.
	if (!peaks.hasCompleteSweep || complete) {
		peaks.minima.set(peaks.pendingMinima);
		peaks.maxima.set(peaks.pendingMaxima);
	}
	if (complete) {
		peaks.phase = 0;
		peaks.hasCompleteSweep = true;
	}
}
