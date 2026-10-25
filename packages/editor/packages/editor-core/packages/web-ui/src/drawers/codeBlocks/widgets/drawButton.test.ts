import { createMockState } from '@8f4e/editor-state-testing';
import type { Button } from '@8f4e/editor-state-types';
import { describe, expect, it, type vi } from 'vitest';
import { createDrawContextMock, createSpriteIdLookupMock } from '../../../__tests__/rendering';
import drawButton from './drawButton';

const control: Button = {
	x: 10,
	y: 20,
	width: 32,
	height: 16,
	id: 'gate',
	allocationUnitAddress: 0,
	isInteger: true,
	offValue: 0,
	onValue: 1,
};

function createTestState() {
	return createMockState({
		viewport: { vGrid: 8, hGrid: 16 },
		spriteLookups: {
			fillColors: createSpriteIdLookupMock(),
			fontControlKnob: createSpriteIdLookupMock(),
		} as never,
	});
}

describe('drawButton', () => {
	it('builds the off state from fill rectangles and basic characters', () => {
		const engine = createDrawContextMock();
		const state = createTestState();

		drawButton(engine, state, control, false);

		const drawSprite = (engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite;
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
		expect(drawSprite.mock.calls).toEqual([
			[10, 20, 'switchBackground', 32, 16],
			[18, 20, 'controlKnob', 8, 16],
		]);
		expect(drawText).toHaveBeenCalledWith(10, 20, '[| ]', state.spriteLookups?.fontControlKnob);
	});

	it('moves the knob fill and vertical bar to the on position', () => {
		const engine = createDrawContextMock();
		const state = createTestState();

		drawButton(engine, state, control, true);

		const drawSprite = (engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite;
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;
		expect(drawSprite.mock.calls).toEqual([
			[10, 20, 'switchBackground', 32, 16],
			[26, 20, 'controlKnob', 8, 16],
		]);
		expect(drawText).toHaveBeenCalledWith(10, 20, '[ |]', state.spriteLookups?.fontControlKnob);
	});
});
