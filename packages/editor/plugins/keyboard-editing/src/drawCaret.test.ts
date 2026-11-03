import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { createDrawingContext } from './__tests__/drawing';
import drawCaret from './drawCaret';

describe('editing caret drawer', () => {
	it.each([
		[false, PALETTE_INDICES.inkBase],
		[true, PALETTE_INDICES.inkFaint],
	] as const)('draws at the shared position with disabled=%s', (disabled, color) => {
		const block = createMockCodeBlock({ disabled, cursor: { row: 1, col: 2, x: 32, y: 48 } });
		const state = createMockState({
			editorMode: 'edit',
			codeBlockRendering: { selectedCodeBlock: block, currentProject: { path: '', entries: [], blocks: [block] } },
		});
		const { draw, context } = createDrawingContext(state, block);
		drawCaret(context);
		expect(draw.drawText).toHaveBeenCalledWith(32, 48, '_', color);
	});
	it('does not draw in view mode', () => {
		const block = createMockCodeBlock();
		const state = createMockState({
			editorMode: 'view',
			codeBlockRendering: { selectedCodeBlock: block, currentProject: { path: '', entries: [], blocks: [block] } },
		});
		const { draw, context } = createDrawingContext(state, block);
		drawCaret(context);
		expect(draw.drawText).not.toHaveBeenCalled();
	});
	it('does not draw for an unselected block', () => {
		const block = createMockCodeBlock();
		const state = createMockState({
			editorMode: 'edit',
			codeBlockRendering: { currentProject: { path: '', entries: [], blocks: [block] } },
		});
		const { draw, context } = createDrawingContext(state, block);
		drawCaret(context);
		expect(draw.drawText).not.toHaveBeenCalled();
	});
});
