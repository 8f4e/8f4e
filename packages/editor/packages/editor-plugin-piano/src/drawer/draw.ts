import type { State } from '@8f4e/editor-state-types';
import type { SpriteIdLookups } from '@8f4e/sprite-generator';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import type { PianoKeyboard, PianoKeyboardKey } from '../types';

function drawPressedKey(engine: DrawContext, spriteLookups: SpriteIdLookups, key: PianoKeyboardKey): void {
	const font = key.kind === 'black' ? spriteLookups.fontPrimaryOverlay : spriteLookups.fontDarkOverlaySoft;
	for (const y of key.pressedOverlayRows) {
		engine.drawText(key.x, y, ';;', font);
	}
}

function drawRuntimePressedKeys(
	engine: DrawContext,
	spriteLookups: SpriteIdLookups,
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
			drawPressedKey(engine, spriteLookups, keys[keyOffset]);
		}
	}
}

export function drawPianoKeyboards(
	engine: DrawContext,
	state: State,
	keyboards: PianoKeyboard[],
	memoryViews: MemoryViews
): void {
	if (!state.spriteLookups) {
		return;
	}
	const spriteLookups = state.spriteLookups;

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
				engine.drawSprite(key.x, keyY, spriteLookups.fillColors.darkBase, keyWidth, blackKeyHeight);
				engine.drawSprite(key.x, blackKeySideY, spriteLookups.fillColors.lightBase, keyWidth, blackKeySideHeight);
				engine.drawSprite(
					key.x + blackKeyGapXOffset,
					blackKeyGapY,
					spriteLookups.fillColors.darkBase,
					blackKeyGapWidth,
					blackKeyGapHeight
				);
			} else {
				engine.drawSprite(key.x, keyY, spriteLookups.fillColors.lightBase, keyWidth, keyHeight);
			}
		}

		drawRuntimePressedKeys(
			engine,
			spriteLookups,
			keys,
			pressedKeysListMemory,
			pressedKeyCountMemory,
			startingMidiNote,
			memoryViews
		);

		for (const key of keys) {
			if (key.offset % 2 === 1) {
				engine.drawSprite(key.x, 0, spriteLookups.fillColors.primarySoft, keyWidth, keyY);
			}
			engine.drawText(key.x, 0, key.label, spriteLookups.fontInkBase);
		}
		engine.endGroup();
	}
}
