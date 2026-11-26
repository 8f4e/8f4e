import { isPointerSource, parseElementCount, parseFiniteNumber } from '@8f4e/editor-state';

export interface PlotDirectiveData {
	startAddressMemoryId: string;
	lineNumber: number;
	length: string | number;
	minValueOverride?: number;
	maxValueOverride?: number;
}

export function createPlotDirectiveData(args: string[], lineNumber: number): PlotDirectiveData | undefined {
	if ((args.length !== 2 && args.length !== 4) || !isPointerSource(args[0])) {
		return undefined;
	}

	const length = parseElementCount(args[1]);
	const minValueOverride = args.length === 4 ? parseFiniteNumber(args[2]) : undefined;
	const maxValueOverride = args.length === 4 ? parseFiniteNumber(args[3]) : undefined;
	if (!length || (args.length === 4 && (minValueOverride === undefined || maxValueOverride === undefined))) {
		return undefined;
	}

	return {
		startAddressMemoryId: args[0],
		lineNumber,
		length,
		minValueOverride,
		maxValueOverride,
	};
}
