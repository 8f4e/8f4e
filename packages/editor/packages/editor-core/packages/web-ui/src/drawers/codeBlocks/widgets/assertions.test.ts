import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockSpriteLookups, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../../../__tests__/rendering';
import drawAssertions from './assertions';

describe('assertion rectangles', () => {
	it('draws passed and failed assertions using their derived rectangles', () => {
		const engine = createDrawContextMock();
		const state = createMockState({ spriteLookups: createMockSpriteLookups() as never });
		const block = createMockCodeBlock();
		block.widgets.assertions = [
			{ lineNumber: 2, passed: true, x: 8, y: 32, width: 16, height: 16 },
			{ lineNumber: 4, passed: false, x: 8, y: 64, width: 16, height: 16 },
		];
		drawAssertions(engine, state, block);
		expect(engine.drawFill).toHaveBeenNthCalledWith(1, 8, 32, PALETTE_INDICES.positiveBase, 16, 16);
		expect(engine.drawFill).toHaveBeenNthCalledWith(2, 8, 64, PALETTE_INDICES.negativeBase, 16, 16);
	});

	it('omits markers for disabled blocks or missing sprite lookups', () => {
		const engine = createDrawContextMock();
		const state = createMockState();
		const block = createMockCodeBlock();
		block.widgets.assertions = [{ lineNumber: 2, passed: true, x: 8, y: 32, width: 8, height: 16 }];
		state.spriteLookups = undefined;
		drawAssertions(engine, state, block);
		state.spriteLookups = createMockSpriteLookups() as never;
		block.disabled = true;
		drawAssertions(engine, state, block);
		expect(vi.mocked(engine.drawFill)).not.toHaveBeenCalled();
	});
});
