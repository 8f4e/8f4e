import { isMemoryAddress } from '@8f4e/editor-state';

export interface CrossfadeDirectiveData {
	leftMemoryId: string;
	rightMemoryId: string;
	lineNumber: number;
}

export function createCrossfadeDirectiveData(args: string[], lineNumber: number): CrossfadeDirectiveData | undefined {
	if (args.length !== 2) {
		return undefined;
	}

	if (!isMemoryAddress(args[0]) || !isMemoryAddress(args[1])) {
		return undefined;
	}

	return {
		leftMemoryId: args[0],
		rightMemoryId: args[1],
		lineNumber,
	};
}
