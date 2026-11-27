import { getMemoryDefaultEdits, type MemoryDefaultEdit, type MemoryDefaultValue } from '@8f4e/editor-state/memory';
import type { State } from '@8f4e/editor-state-types';
import type { PianoMemoryBindings } from '../types';

function getPianoDefaults(bindings: PianoMemoryBindings[], read: (address: number) => number): MemoryDefaultValue[][] {
	return bindings.map(binding => {
		const notes = binding.pressedKeysListMemory;
		const countMemory = binding.pressedKeyCountMemory;
		const count = Math.min(Math.max(0, read(countMemory.allocationUnitAddress)), notes.numberOfElements);
		const values: string[] = [];
		for (let index = 0; index < count; index++) {
			values.push(read(notes.allocationUnitAddress + index).toString());
		}
		return [
			{ moduleId: binding.pressedKeysListModuleId, memoryName: notes.name!, value: values.join(' '), isArray: true },
			{
				moduleId: binding.pressedKeyCountModuleId,
				memoryName: countMemory.name!,
				value: count.toString(),
				isArray: false,
			},
		];
	});
}

export function getPianoDefaultEdits(state: State, bindings: PianoMemoryBindings[]): MemoryDefaultEdit[] {
	const read = state.callbacks.getWordFromMemory;
	if (!read) return [];
	return getMemoryDefaultEdits(
		state,
		getPianoDefaults(bindings, address => read(address) ?? 0)
	);
}
