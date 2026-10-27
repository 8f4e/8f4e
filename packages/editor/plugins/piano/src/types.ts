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
	pressedKeyCountMemory: PlannedMemoryDeclaration;
	pressedKeysListModuleId: string;
	pressedKeyCountModuleId: string;
	startingMidiNote: number;
}

export interface PianoKeyboardKey {
	offset: number;
	x: number;
	label: string;
	kind: 'white' | 'black';
	pressedOverlayRows: number[];
}
