import { getMemoryDefaultEdits, type MemoryDefaultEdit, type MemoryDefaultValue } from '@8f4e/editor-state/memory';
import type { State } from '@8f4e/editor-state-types';
import type { Slider } from '../types';

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

function getDecimalPlaces(value: number): number {
	const text = value.toString();
	const exponentMatch = text.match(/e-(\d+)$/i);
	if (exponentMatch) {
		return Number.parseInt(exponentMatch[1], 10);
	}

	return text.includes('.') ? text.split('.')[1].length : 0;
}

function readRuntimeSliderValue(slider: Slider, getWordFromMemory: (allocationUnitAddress: number) => number): number {
	if (slider.isInteger) {
		return getWordFromMemory(slider.allocationUnitAddress);
	}

	if (slider.isFloat64) {
		return decodeFloat64Words(
			getWordFromMemory(slider.allocationUnitAddress),
			getWordFromMemory(slider.allocationUnitAddress + 1)
		);
	}

	return decodeFloat32Word(getWordFromMemory(slider.allocationUnitAddress));
}

function formatRuntimeSliderValue(value: number, slider: Slider): string | undefined {
	if (!Number.isFinite(value)) {
		return undefined;
	}

	if (slider.isInteger) {
		return `${Math.round(value)}`;
	}

	const decimalPlaces =
		slider.step !== undefined ? Math.min(12, getDecimalPlaces(slider.step)) : slider.isFloat64 ? 12 : 6;
	const roundedValue = Number.parseFloat(value.toFixed(decimalPlaces));
	const serializedValue = Object.is(roundedValue, -0) ? '0' : roundedValue.toString();

	return /[.eE]/.test(serializedValue) ? serializedValue : `${serializedValue}.0`;
}

function getSliderDefaults(sliders: Slider[], read: (address: number) => number): MemoryDefaultValue[][] {
	return sliders.flatMap(slider => {
		const value = formatRuntimeSliderValue(readRuntimeSliderValue(slider, read), slider);
		return value === undefined ? [] : [[{ moduleId: slider.moduleId, memoryId: slider.id, value, isArray: false }]];
	});
}

export function getSliderDefaultEdits(state: State, sliders: Slider[]): MemoryDefaultEdit[] {
	const read = state.callbacks.getWordFromMemory;
	if (!read) return [];
	return getMemoryDefaultEdits(state, getSliderDefaults(sliders, read));
}
