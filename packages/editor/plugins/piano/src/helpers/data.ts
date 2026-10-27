import { isMemoryAddress, parseInteger } from '@8f4e/editor-state';

export interface PianoDirectiveData {
	sourceLineIndex: number;
	pressedKeyCountMemoryId: string;
	pressedKeysListMemoryId: string;
	startingMidiNote: number;
}

export function createPianoDirectiveData(args: string[], sourceLineIndex: number): PianoDirectiveData | undefined {
	if ((args.length !== 2 && args.length !== 3) || !isMemoryAddress(args[0]) || !isMemoryAddress(args[1])) {
		return undefined;
	}

	const startingMidiNote = args[2] === undefined ? 0 : parseInteger(args[2]);
	if (startingMidiNote === undefined || startingMidiNote < 0) {
		return undefined;
	}

	return {
		sourceLineIndex,
		pressedKeyCountMemoryId: args[1],
		pressedKeysListMemoryId: args[0],
		startingMidiNote,
	};
}
