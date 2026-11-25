import { isPointerSource, parseFiniteNumber } from '@8f4e/editor-state';

export interface MeterDirectiveData {
	memoryId?: string;
	lineNumber: number;
	minValueOverride?: number;
	maxValueOverride?: number;
}

export function createMeterDirectiveData(args: string[], lineNumber: number): MeterDirectiveData | undefined {
	const [memoryId] = args;
	if (memoryId === undefined) return { lineNumber };
	if (!isPointerSource(memoryId)) return;
	if (args.length === 1) return { memoryId, lineNumber };

	if (args.length !== 3) {
		return undefined;
	}

	const minValueOverride = parseFiniteNumber(args[1]);
	const maxValueOverride = parseFiniteNumber(args[2]);
	if (minValueOverride === undefined || maxValueOverride === undefined) {
		return undefined;
	}

	return {
		memoryId,
		lineNumber,
		minValueOverride,
		maxValueOverride,
	};
}
