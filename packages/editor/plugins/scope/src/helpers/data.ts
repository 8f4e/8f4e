import { isPointerSource, parseFiniteNumber } from '@8f4e/editor-state';

/** Faster interval requests did not increase sustained browser sampling throughput. */
export const MAX_SCOPE_SAMPLE_RATE_HZ = 250;

export interface ScopeDirectiveData {
	memoryId: string;
	lineNumber: number;
	sampleRate: number;
	minValueOverride?: number;
	maxValueOverride?: number;
}

/** Rates are in Hz. Keep intervals within the representable range of browser timers. */
export function createScopeDirectiveData(args: string[], lineNumber: number): ScopeDirectiveData | undefined {
	if ((args.length !== 2 && args.length !== 4) || !isPointerSource(args[0])) return;

	const sampleRate = parseFiniteNumber(args[1]);
	if (
		sampleRate === undefined ||
		sampleRate <= 0 ||
		sampleRate > MAX_SCOPE_SAMPLE_RATE_HZ ||
		1000 / sampleRate > 2_147_483_647
	)
		return;

	const minValueOverride = parseFiniteNumber(args[2]);
	const maxValueOverride = parseFiniteNumber(args[3]);
	if (
		args.length === 4 &&
		(minValueOverride === undefined ||
			maxValueOverride === undefined ||
			minValueOverride >= maxValueOverride ||
			!Number.isFinite(maxValueOverride - minValueOverride))
	)
		return;

	return {
		memoryId: args[0],
		lineNumber,
		sampleRate,
		minValueOverride,
		maxValueOverride,
	};
}
