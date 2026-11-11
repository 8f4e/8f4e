import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { DrawContext as Engine, MemoryViews } from '@8f4e/web-ui';
import { textToGlyphIds } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../__tests__/rendering';
import type { PianoKeyboard } from '../types';
import { drawPianoKeyboards } from './draw';

function createMemoryViews({ int32 = [] }: { int32?: number[] } = {}): MemoryViews {
	return {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(int32),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
}

function createMockEngine(): Engine {
	return createDrawContextMock();
}

function createMockMemory(overrides: Partial<PlannedMemoryDeclaration> = {}): PlannedMemoryDeclaration {
	return {
		id: 0,
		name: 'memory',
		numberOfElements: 1,
		elementWordSize: 4,
		type: 'int' as const,
		byteAddress: 0,
		elementByteLength: 4,
		allocationUnitCount: 1,
		allocatedByteLength: 4,
		allocationUnitAddress: 0,
		endByteAddress: 4,
		endAddressSafeByteLength: 0,
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
			glyphs: textToGlyphIds(isBlack ? 'C#' : 'C'),
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
			id: 0,
			name: 'notes',
			byteAddress: 16,
			allocationUnitAddress: 4,
			allocationUnitCount: 12,
			numberOfElements: 12,
		}),
		pressedKeyCountMemory: createMockMemory({
			id: 1,
			name: 'notesCount',
			byteAddress: 4,
			allocationUnitAddress: 1,
		}),
		startingMidiNote: 48,
		...overrides,
	};
}

describe('drawPianoKeyboards', () => {
	const pressedOverlay = textToGlyphIds('░░');

	it('draws piano keys as fill-color rectangles', () => {
		const engine = createMockEngine();
		const keyboards = [createPianoKeyboard()];

		drawPianoKeyboards(engine, keyboards, createMemoryViews({ int32: [0, 2, 0, 0, 48, 49] }));

		const drawSprite = vi.mocked(engine.drawFill);
		const drawGlyphs = (engine as unknown as { drawGlyphs: ReturnType<typeof vi.fn> }).drawGlyphs;

		expect(engine.startGroup).toHaveBeenCalledWith(2, 3);
		expect(drawSprite).toHaveBeenCalledWith(0, 4, PALETTE_INDICES.lightBase, 2, 20);
		expect(drawSprite).toHaveBeenCalledWith(2, 4, PALETTE_INDICES.darkBase, 2, 12);
		expect(drawSprite).toHaveBeenCalledWith(2, 16, PALETTE_INDICES.lightBase, 2, 8);
		expect(drawSprite).toHaveBeenCalledWith(2.75, 16, PALETTE_INDICES.darkBase, 0.5, 8);
		expect(drawSprite).toHaveBeenCalledWith(4, 4, PALETTE_INDICES.lightBase, 2, 20);
		expect(drawGlyphs).toHaveBeenCalledWith(0, 4, pressedOverlay, PALETTE_INDICES.darkOverlaySoft);
		expect(drawGlyphs).toHaveBeenCalledWith(0, 8, pressedOverlay, PALETTE_INDICES.darkOverlaySoft);
		expect(drawGlyphs).toHaveBeenCalledWith(0, 12, pressedOverlay, PALETTE_INDICES.darkOverlaySoft);
		expect(drawGlyphs).toHaveBeenCalledWith(0, 16, pressedOverlay, PALETTE_INDICES.darkOverlaySoft);
		expect(drawGlyphs).toHaveBeenCalledWith(0, 20, pressedOverlay, PALETTE_INDICES.darkOverlaySoft);
		expect(drawGlyphs).toHaveBeenCalledWith(2, 4, pressedOverlay, PALETTE_INDICES.primaryOverlay);
		expect(drawGlyphs).toHaveBeenCalledWith(2, 8, pressedOverlay, PALETTE_INDICES.primaryOverlay);
		expect(drawGlyphs).toHaveBeenCalledWith(2, 12, pressedOverlay, PALETTE_INDICES.primaryOverlay);
		expect(drawGlyphs).not.toHaveBeenCalledWith(2, 16, pressedOverlay, expect.any(Number));
		expect(drawGlyphs).not.toHaveBeenCalledWith(2, 20, pressedOverlay, expect.any(Number));
	});

	it('does not draw pressed overlays when runtime memory has no pressed count', () => {
		const engine = createMockEngine();
		const keyboards = [createPianoKeyboard()];

		drawPianoKeyboards(engine, keyboards, createMemoryViews({ int32: [0, 0, 0, 0, 0, 0] }));

		const drawSprite = vi.mocked(engine.drawFill);
		const drawGlyphs = (engine as unknown as { drawGlyphs: ReturnType<typeof vi.fn> }).drawGlyphs;

		expect(drawSprite).toHaveBeenCalledWith(4, 4, PALETTE_INDICES.lightBase, 2, 20);
		expect(drawGlyphs).not.toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			pressedOverlay,
			expect.any(Number)
		);
	});

	it('draws duplicate runtime notes directly without normalizing pressed keys', () => {
		const engine = createMockEngine();
		const keyboards = [createPianoKeyboard()];

		drawPianoKeyboards(engine, keyboards, createMemoryViews({ int32: [0, 2, 0, 0, 48, 48] }));

		const drawGlyphs = (engine as unknown as { drawGlyphs: ReturnType<typeof vi.fn> }).drawGlyphs;
		const overlayCalls = drawGlyphs.mock.calls.filter(call => call[2][0] === pressedOverlay[0]);

		expect(overlayCalls.filter(call => call[0] === 0)).toHaveLength(10);
	});
});
