import { createMockState } from '@8f4e/editor-state-testing';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { DrawContext as Engine, MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it, type vi } from 'vitest';
import { createDrawContextMock, createSpriteIdLookupMock } from '../__tests__/rendering';
import type { PianoKeyboard } from '../types';
import { drawPianoKeyboards } from './draw';

function createMemoryViews({ int32 = [], float32 = [] }: { int32?: number[]; float32?: number[] } = {}): MemoryViews {
	return {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(int32),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(float32),
		float64: new Float64Array(0),
	};
}

function createMockEngine(): Engine {
	return createDrawContextMock();
}

function createMockMemory(overrides: Partial<PlannedMemoryDeclaration> = {}): PlannedMemoryDeclaration {
	return {
		id: 'memory',
		numberOfElements: 1,
		elementWordSize: 4,
		type: 'int' as const,
		byteAddress: 0,
		elementByteLength: 4,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		allocationUnitAddress: 0,
		endByteAddress: 4,
		endAddressSafeByteLength: 4,
		lineNumber: 0,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		...overrides,
	};
}

function createPianoKeyboardKeys(): PianoKeyboard['keys'] {
	return Array.from({ length: 24 }, (_, offset) => {
		const isBlack = [1, 3, 6, 8, 10].includes(offset % 12);
		return {
			offset,
			x: offset * 2,
			label: isBlack ? 'C#' : 'C',
			kind: isBlack ? 'black' : 'white',
			pressedOverlayRows: isBlack ? [4, 8, 12] : [4, 8, 12, 16, 20],
		};
	});
}

function createPianoKeyboard(overrides: Partial<PianoKeyboard> = {}): PianoKeyboard {
	return {
		pressedKeysListModuleId: 'test-block',
		pressedKeyCountModuleId: 'test-block',
		x: 2,
		y: 3,
		width: 48,
		height: 24,
		keyWidth: 2,
		keyY: 4,
		keyHeight: 20,
		blackKeyHeight: 12,
		blackKeySideY: 16,
		blackKeySideHeight: 8,
		blackKeyGapXOffset: 0.75,
		blackKeyGapY: 16,
		blackKeyGapWidth: 0.5,
		blackKeyGapHeight: 8,
		keys: createPianoKeyboardKeys(),
		pressedKeysListMemory: createMockMemory({
			id: 'notes',
			byteAddress: 16,
			allocationUnitAddress: 4,
			allocationUnitCount: 12,
			numberOfElements: 12,
		}),
		pressedKeyCountMemory: createMockMemory({
			id: 'notesCount',
			byteAddress: 4,
			allocationUnitAddress: 1,
		}),
		startingMidiNote: 48,
		...overrides,
	};
}

describe('drawPianoKeyboards', () => {
	it('draws piano keys as fill-color rectangles', () => {
		const engine = createMockEngine();
		const state = createMockState({
			viewport: {
				vGrid: 1,
				hGrid: 4,
			},
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontCode: createSpriteIdLookupMock(),
				fontPianoKeyWhitePressedOverlay: createSpriteIdLookupMock(),
				fontPianoKeyBlackPressedOverlay: createSpriteIdLookupMock(),
			} as never,
		});
		const keyboards = [createPianoKeyboard()];

		drawPianoKeyboards(engine, state, keyboards, createMemoryViews({ int32: [0, 2, 0, 0, 48, 49] }));

		const drawSprite = (engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite;
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;

		expect(engine.startGroup).toHaveBeenCalledWith(2, 3);
		expect(drawSprite).toHaveBeenCalledWith(0, 4, 'pianoKeyWhite', 2, 20);
		expect(drawSprite).toHaveBeenCalledWith(2, 4, 'pianoKeyBlack', 2, 12);
		expect(drawSprite).toHaveBeenCalledWith(2, 16, 'pianoKeyWhite', 2, 8);
		expect(drawSprite).toHaveBeenCalledWith(2.75, 16, 'pianoKeyBlack', 0.5, 8);
		expect(drawSprite).toHaveBeenCalledWith(4, 4, 'pianoKeyWhite', 2, 20);
		expect(drawText).toHaveBeenCalledWith(0, 4, ';;', state.spriteLookups?.fontPianoKeyWhitePressedOverlay);
		expect(drawText).toHaveBeenCalledWith(0, 8, ';;', state.spriteLookups?.fontPianoKeyWhitePressedOverlay);
		expect(drawText).toHaveBeenCalledWith(0, 12, ';;', state.spriteLookups?.fontPianoKeyWhitePressedOverlay);
		expect(drawText).toHaveBeenCalledWith(0, 16, ';;', state.spriteLookups?.fontPianoKeyWhitePressedOverlay);
		expect(drawText).toHaveBeenCalledWith(0, 20, ';;', state.spriteLookups?.fontPianoKeyWhitePressedOverlay);
		expect(drawText).toHaveBeenCalledWith(2, 4, ';;', state.spriteLookups?.fontPianoKeyBlackPressedOverlay);
		expect(drawText).toHaveBeenCalledWith(2, 8, ';;', state.spriteLookups?.fontPianoKeyBlackPressedOverlay);
		expect(drawText).toHaveBeenCalledWith(2, 12, ';;', state.spriteLookups?.fontPianoKeyBlackPressedOverlay);
		expect(drawText).not.toHaveBeenCalledWith(2, 16, ';;');
		expect(drawText).not.toHaveBeenCalledWith(2, 20, ';;');
	});

	it('does not draw pressed overlays when runtime memory has no pressed count', () => {
		const engine = createMockEngine();
		const state = createMockState({
			viewport: {
				vGrid: 1,
				hGrid: 4,
			},
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontCode: createSpriteIdLookupMock(),
				fontPianoKeyWhitePressedOverlay: createSpriteIdLookupMock(),
				fontPianoKeyBlackPressedOverlay: createSpriteIdLookupMock(),
			} as never,
		});
		const keyboards = [createPianoKeyboard()];

		drawPianoKeyboards(engine, state, keyboards, createMemoryViews({ int32: [0, 0, 0, 0, 0, 0] }));

		const drawSprite = (engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite;
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;

		expect(drawSprite).toHaveBeenCalledWith(4, 4, 'pianoKeyWhite', 2, 20);
		expect(drawText).not.toHaveBeenCalledWith(expect.any(Number), expect.any(Number), ';;');
	});

	it('draws duplicate runtime notes directly without normalizing pressed keys', () => {
		const engine = createMockEngine();
		const state = createMockState({
			viewport: {
				vGrid: 1,
				hGrid: 4,
			},
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontCode: createSpriteIdLookupMock(),
				fontPianoKeyWhitePressedOverlay: createSpriteIdLookupMock(),
				fontPianoKeyBlackPressedOverlay: createSpriteIdLookupMock(),
			} as never,
		});
		const keyboards = [createPianoKeyboard()];

		drawPianoKeyboards(engine, state, keyboards, createMemoryViews({ int32: [0, 2, 0, 0, 48, 48] }));

		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
		const overlayCalls = drawText.mock.calls.filter(call => call[2] === ';;');

		expect(overlayCalls.filter(call => call[0] === 0)).toHaveLength(10);
	});
});
