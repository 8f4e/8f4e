import { isPointerSource, parseFiniteNumber } from '@8f4e/editor-state';

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
	if (sampleRate === undefined || sampleRate <= 0 || sampleRate > 1000 || 1000 / sampleRate > 2_147_483_647) return;

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
