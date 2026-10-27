import { isMemoryAddress, parseFiniteNumber } from '@8f4e/editor-state';

export interface SliderDirectiveData {
	memoryId: string;
	sourceLineIndex: number;
	min: number | undefined;
	max: number | undefined;
	step: number | undefined;
}

export function createSliderDirectiveData(args: string[], sourceLineIndex: number): SliderDirectiveData | undefined {
	if (args.length < 1 || args.length > 4 || !isMemoryAddress(args[0])) {
		return undefined;
	}

	const min = args[1] !== undefined ? parseFiniteNumber(args[1]) : undefined;
	const max = args[2] !== undefined ? parseFiniteNumber(args[2]) : undefined;
	const step = args[3] !== undefined ? parseFiniteNumber(args[3]) : undefined;
	if (
		(args[1] !== undefined && min === undefined) ||
		(args[2] !== undefined && max === undefined) ||
		(args[3] !== undefined && (step === undefined || step <= 0))
	) {
		return undefined;
	}

	return {
		memoryId: args[0],
		sourceLineIndex,
		min,
		max,
		step,
	};
}
