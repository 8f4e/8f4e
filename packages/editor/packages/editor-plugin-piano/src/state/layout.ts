import { gapCalculator } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type {
	CodeBlockGraphicData,
	DirectiveDerivedState,
	DirectiveLayoutCallbacks,
	State,
} from '@8f4e/editor-state-types';
import type { PianoDirectiveData } from '../helpers/data';
import type { PianoKeyboard, PianoKeyboardKey } from '../types';
import { PIANO_KEYBOARD_MIN_GRID_WIDTH } from './constants';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEY_COUNT = 24;

function getNoteIndex(noteNumber: number): number {
	return ((noteNumber % NOTE_LABELS.length) + NOTE_LABELS.length) % NOTE_LABELS.length;
}

function createPianoKeyboardKeys(
	keyWidth: number,
	keyY: number,
	keyHeight: number,
	blackKeyHeight: number,
	rowHeight: number,
	startingNumber: number
): PianoKeyboardKey[] {
	const whiteKeyPressedOverlayRows = Array.from(
		{ length: Math.ceil(keyHeight / rowHeight) },
		(_, row) => keyY + row * rowHeight
	);
	const blackKeyPressedOverlayRows = Array.from(
		{ length: Math.ceil(blackKeyHeight / rowHeight) },
		(_, row) => keyY + row * rowHeight
	);

	return Array.from({ length: KEY_COUNT }, (_, offset) => {
		const note = getNoteIndex(startingNumber + offset);
		const isBlack = BLACK_KEYS.has(note);
		const x = offset * keyWidth;
		const baseKey = {
			offset,
			x,
			label: NOTE_LABELS[note],
			labelX: x,
			labelY: 0,
			pressedOverlayX: x,
		};

		if (isBlack) {
			return {
				...baseKey,
				kind: 'black',
				sprite: 'pianoKeyBlack',
				pressedOverlayRows: blackKeyPressedOverlayRows,
				pressedOverlayFont: 'fontPianoKeyBlackPressedOverlay',
			};
		}

		return {
			...baseKey,
			kind: 'white',
			sprite: 'pianoKeyWhite',
			pressedOverlayRows: whiteKeyPressedOverlayRows,
			pressedOverlayFont: 'fontPianoKeyWhitePressedOverlay',
		};
	});
}

function resolvePianoDirectiveWidget(
	pianoKeyboard: PianoDirectiveData,
	graphicData: CodeBlockGraphicData,
	state: State,
	directiveState: DirectiveDerivedState,
	keyboards: PianoKeyboard[]
): void {
	if (!graphicData.name) {
		return;
	}

	const scope = getCodeBlockMemoryScope(graphicData);
	const memoryIdentifierKeysList = resolveMemoryIdentifier(state, scope, pianoKeyboard.pressedKeysListMemoryId);
	const memoryIdentifierNumberOfKeys = resolveMemoryIdentifier(state, scope, pianoKeyboard.pressedNumberOfKeysMemoryId);

	if (!memoryIdentifierKeysList || !memoryIdentifierNumberOfKeys) {
		return;
	}

	const displayRow =
		directiveState.displayModel.sourceLineIndexToDisplayRow[pianoKeyboard.sourceLineIndex] ??
		pianoKeyboard.sourceLineIndex;
	const keyWidth = state.viewport.vGrid * 2;
	const keyY = state.viewport.hGrid;
	const keyHeight = state.viewport.hGrid * 5;
	const height = keyY + keyHeight;
	const blackKeyHeight = state.viewport.hGrid * 3;
	const blackKeySideHeight = Math.max(1, keyHeight - blackKeyHeight);
	const blackKeyGapWidth = Math.max(1, keyWidth) / 4;

	keyboards.push({
		x: 0,
		y: (gapCalculator(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
		width: KEY_COUNT * keyWidth,
		height,
		keyWidth,
		keyY,
		keyHeight,
		blackKeyHeight,
		blackKeySideY: keyY + blackKeyHeight,
		blackKeySideHeight,
		blackKeyGapXOffset: keyWidth / 2 - blackKeyGapWidth / 2,
		blackKeyGapY: keyY + blackKeyHeight,
		blackKeyGapWidth,
		blackKeyGapHeight: blackKeySideHeight,
		keys: createPianoKeyboardKeys(
			keyWidth,
			keyY,
			keyHeight,
			blackKeyHeight,
			state.viewport.hGrid,
			pianoKeyboard.startingNumber
		),
		pressedKeysListMemory: memoryIdentifierKeysList.memory,
		pressedNumberOfKeysMemory: memoryIdentifierNumberOfKeys.memory,
		pressedKeysListModuleId: memoryIdentifierKeysList.target.moduleId,
		pressedNumberOfKeysModuleId: memoryIdentifierNumberOfKeys.target.moduleId,
		startingNumber: pianoKeyboard.startingNumber,
	});
}

export function createPianoDirectiveLayoutCallbacks(
	pianoKeyboard: PianoDirectiveData,
	keyboardsByBlock: WeakMap<CodeBlockGraphicData, PianoKeyboard[]>
): DirectiveLayoutCallbacks {
	return {
		beforeGraphicDataWidthCalculation: graphicData => {
			graphicData.minGridWidth = PIANO_KEYBOARD_MIN_GRID_WIDTH;
		},
		onBlockLayoutReady: (graphicData, state, directiveState) => {
			resolvePianoDirectiveWidget(
				pianoKeyboard,
				graphicData,
				state,
				directiveState,
				keyboardsByBlock.get(graphicData)!
			);
		},
	};
}
