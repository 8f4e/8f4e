import { isPointerSource, parseElementCount } from '@8f4e/editor-state';

export interface WaveDirectiveData {
	startAddressMemoryId: string;
	length: number | string;
	pointerMemoryId?: string;
	lineNumber: number;
}

export function createWaveDirectiveData(args: string[], lineNumber: number): WaveDirectiveData | undefined {
	if (
		(args.length !== 2 && args.length !== 3) ||
		!isPointerSource(args[0]) ||
		(args[2] !== undefined && !isPointerSource(args[2]))
	) {
		return undefined;
	}

	const length = parseElementCount(args[1]);
	if (!length) {
		return undefined;
	}

	return {
		startAddressMemoryId: args[0],
		length,
		pointerMemoryId: args[2],
		lineNumber,
	};
}
