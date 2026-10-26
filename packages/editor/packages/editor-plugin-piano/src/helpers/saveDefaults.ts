import { getMemoryDefaultEdits, type MemoryDefaultEdit, type MemoryDefaultValue } from '@8f4e/editor-state/memory';
import type { State } from '@8f4e/editor-state-types';
import type { PianoKeyboard } from '../types';

function getPianoDefaults(keyboards: PianoKeyboard[], read: (address: number) => number): MemoryDefaultValue[][] {
	return keyboards.map(keyboard => {
		const notes = keyboard.pressedKeysListMemory;
		const countMemory = keyboard.pressedKeyCountMemory;
		const count = Math.min(Math.max(0, read(countMemory.allocationUnitAddress)), notes.numberOfElements);
		const values: string[] = [];
		for (let index = 0; index < count; index++) {
			values.push(read(notes.allocationUnitAddress + index).toString());
		}
		return [
			{ moduleId: keyboard.pressedKeysListModuleId, memoryId: notes.id, value: values.join(' '), isArray: true },
			{
				moduleId: keyboard.pressedKeyCountModuleId,
				memoryId: countMemory.id,
				value: count.toString(),
				isArray: false,
			},
		];
	});
}

export function getPianoDefaultEdits(state: State, keyboards: PianoKeyboard[]): MemoryDefaultEdit[] {
	const read = state.callbacks.getWordFromMemory;
	if (!read) return [];
	return getMemoryDefaultEdits(state, getPianoDefaults(keyboards, read));
}
