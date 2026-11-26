import type { EditorPluginContext } from '@8f4e/editor-core';
import { displayRowToGridRow, matchEditorDirectives, subscribeToBlockPreparation } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryAddress } from '@8f4e/editor-state/memory';
import type { EditorCodeBlock, EditorLayoutRegistry, State } from '@8f4e/editor-state-types';
import { textToGlyphIds } from '@8f4e/web-ui';
import type { PianoDirectiveData } from '../helpers/data';
import { createPianoDirectiveData } from '../helpers/data';
import type { PianoKeyboard, PianoKeyboardKey, PianoMemoryBindings } from '../types';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_GLYPHS = NOTE_LABELS.map(textToGlyphIds);
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
			glyphs: NOTE_GLYPHS[note],
			kind: isBlack ? 'black' : 'white',
			pressedOverlayRows: isBlack ? blackKeyPressedOverlayRows : whiteKeyPressedOverlayRows,
		};
	});
}

function preparePiano(
	pianoKeyboard: PianoDirectiveData,
	graphicData: EditorCodeBlock,
	state: State,
	bindings: PianoMemoryBindings[],
	keyboards: PianoKeyboard[]
): void {
	if (!graphicData.name) {
		return;
	}

	const scope = getCodeBlockMemoryScope(graphicData);
	const pressedKeysList = resolveMemoryAddress(state, scope, pianoKeyboard.pressedKeysListMemoryId);
	const pressedKeyCount = resolveMemoryAddress(state, scope, pianoKeyboard.pressedKeyCountMemoryId);

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

	const binding = {
		pressedKeysListMemory: pressedKeysList.memory,
		pressedKeyCountMemory: pressedKeyCount.memory,
		pressedKeysListModuleId: pressedKeysList.target.moduleId,
		pressedKeyCountModuleId: pressedKeyCount.target.moduleId,
	};
	bindings.push(binding);

	const displayRow = graphicData.displayModel.sourceLineIndexToDisplayRow[pianoKeyboard.sourceLineIndex];
	if (displayRow === undefined) {
		return;
	}

	const keyWidth = state.viewport.vGrid * 2;
	const keyY = state.viewport.hGrid;
	const keyHeight = state.viewport.hGrid * 5;
	const height = keyY + keyHeight;
	const blackKeyHeight = state.viewport.hGrid * 3;
	const blackKeySideHeight = Math.max(1, keyHeight - blackKeyHeight);
	const blackKeyGapWidth = Math.max(1, keyWidth) / 4;

	keyboards.push({
		x: 0,
		y: (displayRowToGridRow(displayRow, graphicData.gaps) + 1) * state.viewport.hGrid,
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
		...binding,
		startingMidiNote: pianoKeyboard.startingMidiNote,
	});
}

import { PIANO_KEYBOARD_MIN_GRID_WIDTH } from './constants';

export function registerPianoPreparation(
	store: EditorPluginContext['store'],
	layout: EditorLayoutRegistry,
	bindingsByBlock: WeakMap<EditorCodeBlock, PianoMemoryBindings[]>,
	keyboardsByBlock: WeakMap<EditorCodeBlock, PianoKeyboard[]>
): () => void {
	const contribution = layout.createContribution();
	const unsubscribe = subscribeToBlockPreparation(store, layout, 'compiler.result', ({ codeBlock, state }, reason) => {
		const items = matchEditorDirectives(codeBlock.parsedDirectives, [{ name: 'piano' }]).flatMap(directive => {
			const data = createPianoDirectiveData(directive.args, directive.sourceLineIndex);
			return data ? [data] : [];
		});
		if (reason === 'layout') {
			contribution.update(codeBlock, {
				verticalSpaceAfterSourceLine: items.map(data => ({ sourceLineIndex: data.sourceLineIndex, heightInRows: 6 })),
				minGridWidth: items.length ? PIANO_KEYBOARD_MIN_GRID_WIDTH : undefined,
			});
		}
		const bindings: PianoMemoryBindings[] = [];
		const widgets: PianoKeyboard[] = [];
		bindingsByBlock.set(codeBlock, bindings);
		keyboardsByBlock.set(codeBlock, widgets);
		for (const data of items) preparePiano(data, codeBlock, state, bindings, widgets);
	});
	return () => {
		unsubscribe();
		contribution.dispose();
	};
}
