import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';

export interface PianoKeyboard {
	x: number;
	y: number;
	width: number;
	height: number;
	keyWidth: number;
	keyY: number;
	keyHeight: number;
	blackKeyHeight: number;
	blackKeySideY: number;
	blackKeySideHeight: number;
	blackKeyGapXOffset: number;
	blackKeyGapY: number;
	blackKeyGapWidth: number;
	blackKeyGapHeight: number;
	keys: PianoKeyboardKey[];
	pressedKeysListMemory: PlannedMemoryDeclaration;
	pressedNumberOfKeysMemory: PlannedMemoryDeclaration;
	pressedKeysListModuleId: string;
	pressedNumberOfKeysModuleId: string;
	startingNumber: number;
}

interface PianoKeyboardKeyBase {
	offset: number;
	x: number;
	label: string;
	labelX: number;
	labelY: number;
	pressedOverlayX: number;
	pressedOverlayRows: number[];
}

export interface PianoKeyboardWhiteKey extends PianoKeyboardKeyBase {
	kind: 'white';
	sprite: 'pianoKeyWhite';
	pressedOverlayFont: 'fontPianoKeyWhitePressedOverlay';
}

export interface PianoKeyboardBlackKey extends PianoKeyboardKeyBase {
	kind: 'black';
	sprite: 'pianoKeyBlack';
	pressedOverlayFont: 'fontPianoKeyBlackPressedOverlay';
}

export type PianoKeyboardKey = PianoKeyboardWhiteKey | PianoKeyboardBlackKey;
