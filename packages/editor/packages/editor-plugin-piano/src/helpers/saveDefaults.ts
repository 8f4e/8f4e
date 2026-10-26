import { getMemoryDefaultEdits, type MemoryDefaultEdit, type MemoryDefaultValue } from '@8f4e/editor-state/memory';
import type { State } from '@8f4e/editor-state-types';
import type { PianoKeyboard } from '../types';

const float32DecodeBuffer = new ArrayBuffer(4);
const float32DecodeInt32 = new Int32Array(float32DecodeBuffer);
const float32DecodeFloat32 = new Float32Array(float32DecodeBuffer);
const float64DecodeBuffer = new ArrayBuffer(8);
const float64DecodeView = new DataView(float64DecodeBuffer);

function decodeFloat32Word(word: number): number {
	float32DecodeInt32[0] = word;
	return float32DecodeFloat32[0];
}

function decodeFloat64Words(lowWord: number, highWord: number): number {
	float64DecodeView.setInt32(0, lowWord, true);
	float64DecodeView.setInt32(4, highWord, true);
	return float64DecodeView.getFloat64(0, true);
}

function getPianoDefaults(keyboards: PianoKeyboard[], read: (address: number) => number): MemoryDefaultValue[][] {
	return keyboards.flatMap(keyboard => {
		const notes = keyboard.pressedKeysListMemory;
		const countMemory = keyboard.pressedKeyCountMemory;
		const runtimeCount = read(countMemory.allocationUnitAddress);
		if (!Number.isFinite(runtimeCount)) return [];
		const count = Math.min(Math.max(0, Math.trunc(runtimeCount)), notes.numberOfElements);
		const values: string[] = [];
		for (let index = 0; index < count; index++) {
			const address = notes.allocationUnitAddress + (index * notes.elementWordSize) / Int32Array.BYTES_PER_ELEMENT;
			const word = read(address);
			const value = notes.isInteger
				? word
				: notes.isFloat64
					? decodeFloat64Words(word, read(address + 1))
					: decodeFloat32Word(word);
			if (!Number.isFinite(value)) return [];
			const serialized = Object.is(value, -0) ? '0' : value.toString();
			values.push(notes.isInteger || /[.eE]/.test(serialized) ? serialized : `${serialized}.0`);
		}
		return [
			[
				{ moduleId: keyboard.pressedKeysListModuleId, memoryId: notes.id, value: values.join(' '), isArray: true },
				{
					moduleId: keyboard.pressedKeyCountModuleId,
					memoryId: countMemory.id,
					value: count.toString(),
					isArray: false,
				},
			],
		];
	});
}

export function getPianoDefaultEdits(state: State, keyboards: PianoKeyboard[]): MemoryDefaultEdit[] {
	const read = state.callbacks.getWordFromMemory;
	if (!read) return [];
	return getMemoryDefaultEdits(state, getPianoDefaults(keyboards, read));
}
