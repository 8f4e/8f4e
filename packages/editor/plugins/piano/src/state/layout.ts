import { gapCalculator, parseEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry, State } from '@8f4e/editor-state-types';
import type { PianoDirectiveData } from '../helpers/data';
import { createPianoDirectiveData } from '../helpers/data';
import type { PianoKeyboard, PianoKeyboardKey } from '../types';

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
	startingMidiNote: number
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
		const note = getNoteIndex(startingMidiNote + offset);
		const isBlack = BLACK_KEYS.has(note);
		return {
			offset,
			x: offset * keyWidth,
			label: NOTE_LABELS[note],
			kind: isBlack ? 'black' : 'white',
			pressedOverlayRows: isBlack ? blackKeyPressedOverlayRows : whiteKeyPressedOverlayRows,
		};
	});
}

export function resolvePianoLayout(
	pianoKeyboard: PianoDirectiveData,
	graphicData: CodeBlockGraphicData,
	state: State,
	keyboards: PianoKeyboard[]
): void {
	if (!graphicData.name) {
		return;
	}

	const scope = getCodeBlockMemoryScope(graphicData);
	const pressedKeysList = resolveMemoryIdentifier(state, scope, pianoKeyboard.pressedKeysListMemoryId);
	const pressedKeyCount = resolveMemoryIdentifier(state, scope, pianoKeyboard.pressedKeyCountMemoryId);

	if (!pressedKeysList || !pressedKeyCount) {
		return;
	}
	if (
		pressedKeysList.memory.type !== 'int' ||
		pressedKeyCount.memory.type !== 'int' ||
		pressedKeyCount.memory.numberOfElements !== 1
	) {
		return;
	}

	const displayRow =
		graphicData.displayModel.sourceLineIndexToDisplayRow[pianoKeyboard.sourceLineIndex] ??
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
			pianoKeyboard.startingMidiNote
		),
		pressedKeysListMemory: pressedKeysList.memory,
		pressedKeyCountMemory: pressedKeyCount.memory,
		pressedKeysListModuleId: pressedKeysList.target.moduleId,
		pressedKeyCountModuleId: pressedKeyCount.target.moduleId,
		startingMidiNote: pianoKeyboard.startingMidiNote,
	});
}

import { PIANO_KEYBOARD_MIN_GRID_WIDTH } from './constants';

export function registerPianoLayout(
	layout: EditorLayoutRegistry,
	keyboardsByBlock: WeakMap<CodeBlockGraphicData, PianoKeyboard[]>
): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = layout.subscribe(({ codeBlock, state }) => {
		const items = parseEditorDirectives(codeBlock.code, [{ name: 'piano' }]).flatMap(directive => {
			const data = createPianoDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [data] : [];
		});
		contribution.update(codeBlock, {
			verticalSpaceAfterSourceLine: items.map(data => ({ sourceLineIndex: data.sourceLineIndex, heightInRows: 6 })),
			minGridWidth: items.length ? PIANO_KEYBOARD_MIN_GRID_WIDTH : undefined,
		});
		const widgets: PianoKeyboard[] = [];
		keyboardsByBlock.set(codeBlock, widgets);
		for (const data of items) resolvePianoLayout(data, codeBlock, state, widgets);
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
