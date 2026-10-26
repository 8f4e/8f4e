import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockSpriteLookups, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../__tests__/rendering';
import type { ButtonWidget } from '../types';
import drawButton from './drawButton';

const control: ButtonWidget = {
	x: 10,
	y: 20,
	width: 32,
	height: 16,
	allocationUnitAddress: 0,
	isInteger: true,
	offValue: 0,
	onValue: 1,
};

function createTestState() {
	return createMockState({
		viewport: { vGrid: 8, hGrid: 16 },
		spriteLookups: createMockSpriteLookups() as never,
	});
}

describe('drawButton', () => {
	it('builds the off state from fill rectangles and basic characters', () => {
		const engine = createDrawContextMock();
		const state = createTestState();

		drawButton(engine, state, control, false);

		const drawSprite = vi.mocked(engine.drawFill);
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
		expect(drawSprite.mock.calls).toEqual([
			[10, 20, PALETTE_INDICES.accentSurface, 32, 16],
			[18, 20, PALETTE_INDICES.lightBase, 8, 16],
		]);
		expect(drawText).toHaveBeenCalledWith(10, 20, '[| ]', PALETTE_INDICES.darkBase);
	});

	it('moves the knob fill and vertical bar to the on position', () => {
		const engine = createDrawContextMock();
		const state = createTestState();

		drawButton(engine, state, control, true);

		const drawSprite = vi.mocked(engine.drawFill);
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
		expect(drawSprite.mock.calls).toEqual([
			[10, 20, PALETTE_INDICES.accentSurface, 32, 16],
			[26, 20, PALETTE_INDICES.lightBase, 8, 16],
		]);
		expect(drawText).toHaveBeenCalledWith(10, 20, '[ |]', PALETTE_INDICES.darkBase);
	});
});
