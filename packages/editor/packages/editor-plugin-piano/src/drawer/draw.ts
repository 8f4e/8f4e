import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import type { PianoKeyboard, PianoKeyboardKey } from '../types';

function drawPressedKey(engine: DrawContext, key: PianoKeyboardKey): void {
	const color = key.kind === 'black' ? PALETTE_INDICES.primaryOverlay : PALETTE_INDICES.darkOverlaySoft;
	for (const y of key.pressedOverlayRows) {
		engine.drawText(key.x, y, ';;', color);
	}
}

function drawRuntimePressedKeys(
	engine: DrawContext,
	keys: PianoKeyboard['keys'],
	pressedKeysListMemory: PianoKeyboard['pressedKeysListMemory'],
	pressedKeyCountMemory: PianoKeyboard['pressedKeyCountMemory'],
	startingMidiNote: number,
	memoryViews: MemoryViews
): void {
	const numberOfKeys = Math.max(0, memoryViews.int32[pressedKeyCountMemory.allocationUnitAddress] || 0);
	const readableKeys = Math.min(numberOfKeys, pressedKeysListMemory.numberOfElements);

	for (let i = 0; i < readableKeys; i++) {
		const keyValue = memoryViews.int32[pressedKeysListMemory.allocationUnitAddress + i];
		const keyOffset = keyValue - startingMidiNote;

		if (keyOffset >= 0 && keyOffset < keys.length) {
			drawPressedKey(engine, keys[keyOffset]);
		}
	}
}

export function drawPianoKeyboards(engine: DrawContext, keyboards: PianoKeyboard[], memoryViews: MemoryViews): void {
	for (const {
		x,
		y,
		keyWidth,
		keyY,
		keyHeight,
		blackKeyHeight,
		blackKeySideY,
		blackKeySideHeight,
		blackKeyGapXOffset,
		blackKeyGapY,
		blackKeyGapWidth,
		blackKeyGapHeight,
		keys,
		pressedKeysListMemory,
		pressedKeyCountMemory,
		startingMidiNote,
	} of keyboards) {
		engine.startGroup(x, y);

		for (const key of keys) {
			if (key.kind === 'black') {
				engine.drawFill(key.x, keyY, PALETTE_INDICES.darkBase, keyWidth, blackKeyHeight);
				engine.drawFill(key.x, blackKeySideY, PALETTE_INDICES.lightBase, keyWidth, blackKeySideHeight);
				engine.drawFill(
					key.x + blackKeyGapXOffset,
					blackKeyGapY,
					PALETTE_INDICES.darkBase,
					blackKeyGapWidth,
					blackKeyGapHeight
				);
			} else {
				engine.drawFill(key.x, keyY, PALETTE_INDICES.lightBase, keyWidth, keyHeight);
			}
		}

		drawRuntimePressedKeys(engine, keys, pressedKeysListMemory, pressedKeyCountMemory, startingMidiNote, memoryViews);

		for (const key of keys) {
			if (key.offset % 2 === 1) {
				engine.drawFill(key.x, 0, PALETTE_INDICES.primarySoft, keyWidth, keyY);
			}
			engine.drawText(key.x, 0, key.label, PALETTE_INDICES.inkBase);
		}
		engine.endGroup();
	}
}
