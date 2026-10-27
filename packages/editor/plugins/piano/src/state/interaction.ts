import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { PianoKeyboard } from '../types';

// Runtime memory is the source of truth for both clicks and pressed-note highlights.
function readRuntimePressedKeys(keyboard: PianoKeyboard, getWordFromMemory: (address: number) => number): Set<number> {
	const pressedKeys = new Set<number>();

	const numberOfKeys = Math.max(0, getWordFromMemory(keyboard.pressedKeyCountMemory.allocationUnitAddress) || 0);
	const readableKeys = Math.min(numberOfKeys, keyboard.pressedKeysListMemory.numberOfElements);

	for (let i = 0; i < readableKeys; i++) {
		pressedKeys.add(getWordFromMemory(keyboard.pressedKeysListMemory.allocationUnitAddress + i));
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

		const { getWordFromMemory, setWordInMemory } = state.callbacks;
		if (!getWordFromMemory || !setWordInMemory) {
			return;
		}

		const noteNumber = keyboard.startingMidiNote + key;
		const pressedKeys = readRuntimePressedKeys(keyboard, getWordFromMemory);
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
			setWordInMemory(keyboard.pressedKeysListMemory.allocationUnitAddress + index, note, true);
			index += 1;
		}
		setWordInMemory(keyboard.pressedKeyCountMemory.allocationUnitAddress, pressedKeys.size, true);
	};

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);

	return () => {
		events.off('codeBlockPointerDown', onCodeBlockPointerDown);
	};
}
