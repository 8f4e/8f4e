import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { createDrawContextMock } from '../../__tests__/rendering';
import type { DrawContext as Engine } from '../../drawContext';
import drawShapeDeclarations from './drawShapeDeclarations';

function createMockEngine(): Engine {
	return createDrawContextMock();
}

describe('drawShapeDeclarations', () => {
	it('draws precomputed shape declaration labels', () => {
		const fontInkBase = PALETTE_INDICES.inkBase;
		const block = createMockCodeBlock({
			widgets: {
				...createMockCodeBlock().widgets,
				shapeDeclarations: [
					{ x: 24, y: 32, text: 'float* input' },
					{ x: 24, y: 48, text: 'float output' },
				],
			},
		});
		const engine = createMockEngine();

		drawShapeDeclarations(engine, block);

		expect(engine.drawText).toHaveBeenCalledWith(24, 32, 'float* input', fontInkBase);
		expect(engine.drawText).toHaveBeenCalledWith(24, 48, 'float output', fontInkBase);
	});

	it('skips drawing when there are no precomputed labels', () => {
		const block = createMockCodeBlock();
		const engine = createMockEngine();

		drawShapeDeclarations(engine, block);

		expect(engine.drawText).not.toHaveBeenCalled();
	});
});
