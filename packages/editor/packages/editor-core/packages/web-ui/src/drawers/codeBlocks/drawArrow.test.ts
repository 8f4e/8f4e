import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, type vi } from 'vitest';
import { createDrawContextMock, createSpriteIdLookupMock } from '../../__tests__/rendering';
import type { DrawContext as Engine } from '../../drawContext';
import drawArrow from './drawArrow';

function createMockEngine(): Engine {
	return createDrawContextMock();
}

describe('drawArrow', () => {
	it('renders ASCII characters for off-screen directions', () => {
		const engine = createMockEngine();
		const state = createMockState({
			spriteLookups: {
				fontPrimaryBase: createSpriteIdLookupMock(),
			} as never,
			viewport: {
				width: 1024,
				height: 768,
				vGrid: 8,
				hGrid: 16,
				center: { x: 512, y: 384 },
				borderLineCoordinates: {
					top: { startX: 0, startY: 0, endX: 1024, endY: 0 },
					right: { startX: 1024, startY: 0, endX: 1024, endY: 768 },
					bottom: { startX: 0, startY: 768, endX: 1024, endY: 768 },
					left: { startX: 0, startY: 0, endX: 0, endY: 768 },
				},
			},
		});

		drawArrow(engine, createMockCodeBlock({ x: 512, y: -100 }), state);
		drawArrow(engine, createMockCodeBlock({ x: 1200, y: 384 }), state);
		drawArrow(engine, createMockCodeBlock({ x: 512, y: 900 }), state);
		drawArrow(engine, createMockCodeBlock({ x: -100, y: 384 }), state);
		drawArrow(engine, createMockCodeBlock({ x: 1200, y: -100 }), state);

		const font = state.spriteLookups?.fontPrimaryBase;
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			512,
			0,
			'^',
			font
		);
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			1016,
			384,
			'>',
			font
		);
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			512,
			752,
			'v',
			font
		);
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			0,
			384,
			'<',
			font
		);
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			1016,
			24,
			'>',
			font
		);
		expect((engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite).not.toHaveBeenCalled();
	});
});
