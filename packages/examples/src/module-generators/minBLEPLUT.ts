type MinBLEPApproximationOptions = {
	totalZeroCrossings: number;
	oversampling: number;
	cutoffRatio: number;
	fftSize: number;
	fractionalShift: number;
	outputGain: number;
	outputBias: number;
	includeInterpolationGuard: boolean;
};

// This generator follows the common MusicDSP minBLEP construction pipeline:
// Blackman-windowed sinc -> minimum-phase reconstruction via cepstrum folding
// -> integrated step residual.
//
// Source lineage:
// https://www.musicdsp.org/en/latest/Synthesis/211-matlab-octave-code-for-minblep-table-generation.html
//
// The constants below were then tuned so the generated residual tracks the
// ProTracker 2 clone lookup table closely:
// https://raw.githubusercontent.com/8bitbubsy/pt2-clone/master/src/pt2_blep.c
const DEFAULT_OPTIONS: MinBLEPApproximationOptions = {
	totalZeroCrossings: 16,
	oversampling: 16,
	cutoffRatio: 0.9325,
	fftSize: 4096,
	fractionalShift: -0.525,
	outputGain: 0.9857184887433783,
	outputBias: 0.00181097096978212,
	includeInterpolationGuard: true,
};

function assertPowerOfTwo(value: number): void {
	if (!Number.isInteger(value) || value <= 0 || (value & (value - 1)) !== 0) {
		throw new Error(`Expected a positive power-of-two FFT size, received ${value}.`);
	}
}

function sinc(value: number): number {
	if (Math.abs(value) < 1e-12) {
		return 1.0;
	}

	const radians = Math.PI * value;
	return Math.sin(radians) / radians;
}

function blackmanWindow(index: number, size: number): number {
	if (size === 1) {
		return 1.0;
	}

	const phase = (2 * Math.PI * index) / (size - 1);
	return 0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(phase * 2);
}

function reverseBits(value: number, bitCount: number): number {
	let reversed = 0;

	for (let i = 0; i < bitCount; i++) {
		reversed = (reversed << 1) | (value & 1);
		value >>= 1;
	}

	return reversed;
}

function fftInPlace(real: Float64Array, imag: Float64Array, inverse: boolean): void {
	const size = real.length;
	const bitCount = Math.log2(size);
	const direction = inverse ? 1 : -1;

	for (let index = 0; index < size; index++) {
		const swappedIndex = reverseBits(index, bitCount);
		if (swappedIndex <= index) {
			continue;
		}

		const swappedReal = real[index];
		const swappedImag = imag[index];

		real[index] = real[swappedIndex];
		imag[index] = imag[swappedIndex];
		real[swappedIndex] = swappedReal;
		imag[swappedIndex] = swappedImag;
	}

	for (let span = 2; span <= size; span <<= 1) {
		const halfSpan = span >> 1;
		const baseAngle = (direction * 2 * Math.PI) / span;

		for (let start = 0; start < size; start += span) {
			for (let offset = 0; offset < halfSpan; offset++) {
				const angle = baseAngle * offset;
				const twiddleReal = Math.cos(angle);
				const twiddleImag = Math.sin(angle);
				const leftIndex = start + offset;
				const rightIndex = leftIndex + halfSpan;

				const rightReal = twiddleReal * real[rightIndex] - twiddleImag * imag[rightIndex];
				const rightImag = twiddleReal * imag[rightIndex] + twiddleImag * real[rightIndex];

				real[rightIndex] = real[leftIndex] - rightReal;
				imag[rightIndex] = imag[leftIndex] - rightImag;
				real[leftIndex] += rightReal;
				imag[leftIndex] += rightImag;
			}
		}
	}

	if (!inverse) {
		return;
	}

	for (let index = 0; index < size; index++) {
		real[index] /= size;
		imag[index] /= size;
	}
}

function interpolateSignal(signal: readonly number[], position: number): number {
	if (position <= 0) {
		return signal[0];
	}

	const lastIndex = signal.length - 1;
	if (position >= lastIndex) {
		return signal[lastIndex];
	}

	const baseIndex = Math.floor(position);
	const fraction = position - baseIndex;
	const start = signal[baseIndex];
	const end = signal[baseIndex + 1];

	return start + (end - start) * fraction;
}

function buildWindowedSinc(sampleCount: number, oversampling: number, cutoffRatio: number): Float64Array {
	const center = (sampleCount - 1) / 2;
	const normalizedCutoff = (0.5 * cutoffRatio) / oversampling;
	const impulse = new Float64Array(sampleCount);

	for (let index = 0; index < sampleCount; index++) {
		const phase = index - center;
		const window = blackmanWindow(index, sampleCount);
		impulse[index] = 2 * normalizedCutoff * sinc(2 * normalizedCutoff * phase) * window;
	}

	return impulse;
}

function minimumPhaseImpulse(linearPhaseImpulse: Float64Array, fftSize: number): Float64Array {
	const epsilon = 1e-15;
	const real = new Float64Array(fftSize);
	const imag = new Float64Array(fftSize);

	real.set(linearPhaseImpulse);
	fftInPlace(real, imag, false);

	for (let index = 0; index < fftSize; index++) {
		real[index] = Math.log(Math.max(Math.hypot(real[index], imag[index]), epsilon));
		imag[index] = 0.0;
	}

	fftInPlace(real, imag, true);

	const foldedReal = new Float64Array(fftSize);
	const foldedImag = new Float64Array(fftSize);
	const midpoint = fftSize >> 1;

	foldedReal[0] = real[0];
	for (let index = 1; index < midpoint; index++) {
		foldedReal[index] = real[index] * 2;
	}
	foldedReal[midpoint] = real[midpoint];

	fftInPlace(foldedReal, foldedImag, false);

	for (let index = 0; index < fftSize; index++) {
		const magnitude = Math.exp(foldedReal[index]);
		const phase = foldedImag[index];

		real[index] = magnitude * Math.cos(phase);
		imag[index] = magnitude * Math.sin(phase);
	}

	fftInPlace(real, imag, true);

	return real;
}

function generateApproximatePt2MinBlepData(options: Partial<MinBLEPApproximationOptions> = {}): number[] {
	const resolved = { ...DEFAULT_OPTIONS, ...options };
	assertPowerOfTwo(resolved.fftSize);

	const sampleCount = resolved.totalZeroCrossings * resolved.oversampling + 1;
	const linearPhaseImpulse = buildWindowedSinc(sampleCount, resolved.oversampling, resolved.cutoffRatio);
	const minPhaseImpulse = minimumPhaseImpulse(linearPhaseImpulse, resolved.fftSize);

	const step = new Array<number>(sampleCount);
	let accumulator = 0.0;
	for (let index = 0; index < sampleCount; index++) {
		accumulator += minPhaseImpulse[index];
		step[index] = accumulator;
	}

	const normalization = step[sampleCount - 1];
	const residual = step.map(value => 1 - value / normalization);
	const output = new Array<number>(sampleCount);

	for (let index = 0; index < sampleCount; index++) {
		const shifted = interpolateSignal(residual, index + resolved.fractionalShift);
		output[index] = shifted * resolved.outputGain + resolved.outputBias;
	}

	output[sampleCount - 1] = 0.0;

	if (!resolved.includeInterpolationGuard) {
		return output;
	}

	return [...output, 0.0];
}

const minBLEPData = generateApproximatePt2MinBlepData();

const minBLEPLUT = `entry main
module minBLEPLUT
; @public
; @tab 7
; PT2-style minBLEP correction table
; generated from the approximate JS minBLEP pipeline
${minBLEPData.map(value => `float\t${value}`).join('\n')}

moduleEnd
entryEnd`;

export default minBLEPLUT;
