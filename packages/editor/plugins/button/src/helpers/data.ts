import { isMemoryAddress, parseFiniteNumber } from '@8f4e/editor-state';

export interface ButtonDirectiveData {
	id: string;
	lineNumber: number;
	onValue: number;
	offValue: number;
}

export function createButtonDirectiveData(args: string[], lineNumber: number): ButtonDirectiveData | undefined {
	if (args.length < 1 || args.length > 3 || !isMemoryAddress(args[0])) {
		return undefined;
	}
	const offValue = args[1] === undefined ? 0 : parseFiniteNumber(args[1]);
	const onValue = args[2] === undefined ? 1 : parseFiniteNumber(args[2]);
	if (offValue === undefined || onValue === undefined) {
		return undefined;
	}

	return {
		id: args[0],
		lineNumber,
		offValue,
		onValue,
	};
}
