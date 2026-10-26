import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { PianoKeyboard } from '../types';

// Runtime memory is the source of truth for both clicks and pressed-note highlights.
const float32DecodeBuffer = new ArrayBuffer(4);
const float32DecodeInt32 = new Int32Array(float32DecodeBuffer);
const float32DecodeFloat32 = new Float32Array(float32DecodeBuffer);

function readRuntimePressedKeys(state: State, keyboard: PianoKeyboard): Set<number> {
	const pressedKeys = new Set<number>();
	const getWordFromMemory = state.callbacks?.getWordFromMemory;

	if (!getWordFromMemory) {
		return pressedKeys;
	}

	const numberOfKeys = Math.max(
		0,
		Math.trunc(getWordFromMemory(keyboard.pressedNumberOfKeysMemory.allocationUnitAddress)) || 0
	);
	const readableKeys = Math.min(numberOfKeys, keyboard.pressedKeysListMemory.numberOfElements);

	for (let i = 0; i < readableKeys; i++) {
		const word = getWordFromMemory(keyboard.pressedKeysListMemory.allocationUnitAddress + i);
		float32DecodeInt32[0] = word;
		const keyValue = keyboard.pressedKeysListMemory.isInteger ? word : float32DecodeFloat32[0];
		pressedKeys.add(keyValue);
	}

	return pressedKeys;
}

function getClickedKeyOffset(
	state: State,
	codeBlock: CodeBlockGraphicData,
	keyboard: PianoKeyboard,
	x: number
): number {
	const keyboardViewportX = codeBlock.x + keyboard.x - state.viewport.x;

	return Math.floor((x - keyboardViewportX) / keyboard.keyWidth);
}

export function registerPianoInteraction(
	state: State,
	events: EventDispatcher,
	keyboardsByBlock: WeakMap<CodeBlockGraphicData, PianoKeyboard[]>
): () => void {
	const onCodeBlockPointerDown = ({ x, y, codeBlock }: { x: number; y: number; codeBlock: CodeBlockGraphicData }) => {
		const keyboard = keyboardsByBlock
			.get(codeBlock)
			?.find(
				keyboard =>
					x >= codeBlock.x + keyboard.x - state.viewport.x &&
					x <= codeBlock.x + keyboard.x + keyboard.width - state.viewport.x &&
					y >= codeBlock.y + keyboard.y - state.viewport.y &&
					y <= codeBlock.y + keyboard.y + keyboard.height - state.viewport.y
			);

		if (!keyboard) {
			return;
		}

		const key = getClickedKeyOffset(state, codeBlock, keyboard, x);
		if (key < 0 || key >= keyboard.keys.length) {
			return;
		}

		const setWordInMemory = state.callbacks?.setWordInMemory;
		if (!state.callbacks?.getWordFromMemory || !setWordInMemory) {
			return;
		}

		const noteNumber = keyboard.startingNumber + key;
		const pressedKeys = readRuntimePressedKeys(state, keyboard);
		if (pressedKeys.has(noteNumber)) {
			pressedKeys.delete(noteNumber);
		} else {
			if (pressedKeys.size >= keyboard.pressedKeysListMemory.numberOfElements) {
				return;
			}
			pressedKeys.add(noteNumber);
		}

		let index = 0;
		for (const note of pressedKeys) {
			setWordInMemory(
				keyboard.pressedKeysListMemory.allocationUnitAddress + index,
				note,
				keyboard.pressedKeysListMemory.isInteger
			);
			index += 1;
		}
		setWordInMemory(keyboard.pressedNumberOfKeysMemory.allocationUnitAddress, pressedKeys.size, true);
	};

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);

	return () => {
		events.off('codeBlockPointerDown', onCodeBlockPointerDown);
	};
}
