import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { createDrawContextMock, createSpriteIdLookupMock } from '../../__tests__/rendering';
import type { DrawContext as Engine } from '../../drawContext';
import drawShapeDeclarations from './drawShapeDeclarations';

function createMockEngine(): Engine {
	return createDrawContextMock();
}

describe('drawShapeDeclarations', () => {
	it('draws precomputed shape declaration labels', () => {
		const fontInkBase = createSpriteIdLookupMock();
		const block = createMockCodeBlock({
			widgets: {
				...createMockCodeBlock().widgets,
				shapeDeclarations: [
					{ x: 24, y: 32, text: 'float* input' },
					{ x: 24, y: 48, text: 'float output' },
				],
			},
		});
		const state = createMockState({
			spriteLookups: {
				fontInkBase,
			} as never,
		});
		const engine = createMockEngine();

		drawShapeDeclarations(engine, state, block);

		expect(engine.drawText).toHaveBeenCalledWith(24, 32, 'float* input', fontInkBase);
		expect(engine.drawText).toHaveBeenCalledWith(24, 48, 'float output', fontInkBase);
	});

	it('skips drawing when there are no precomputed labels', () => {
		const block = createMockCodeBlock();
		const state = createMockState({
			spriteLookups: {
				fontInkBase: createSpriteIdLookupMock(),
			} as never,
		});
		const engine = createMockEngine();

		drawShapeDeclarations(engine, state, block);

		expect(engine.drawText).not.toHaveBeenCalled();
	});
});
