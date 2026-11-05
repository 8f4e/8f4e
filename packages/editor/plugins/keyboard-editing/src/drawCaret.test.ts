import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { parseBlockDirectives } from '@8f4e/editor-state';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { createDrawingContext } from './__tests__/drawing';
import drawCaret from './drawCaret';

describe('editing caret drawer', () => {
	it.each([
		[false, PALETTE_INDICES.inkBase],
		[true, PALETTE_INDICES.inkFaint],
	] as const)('derives horizontal caret placement with disabled=%s', (disabled, color) => {
		const block = createMockCodeBlock({ code: ['module test', 'push 1'], disabled, cursor: { row: 1, col: 2, y: 48 } });
		const state = createMockState({
			editorMode: 'edit',
			codeBlockRendering: { selectedCodeBlock: block, currentProject: { path: '', entries: [], blocks: [block] } },
		});
		const { draw, context } = createDrawingContext(state, block);
		drawCaret(context);
		expect(draw.drawText).toHaveBeenCalledWith(40, 48, '_', color);
	});
	it('uses source tab stops and line-number width, and responds to source and grid changes', () => {
		const block = createMockCodeBlock({
			code: ['; @tab 4 12', '\tvalue'],
			lineNumberColumnWidth: 2,
			cursor: { row: 1, col: 2, y: 96 },
		});
		const state = createMockState({
			editorMode: 'edit',
			codeBlockRendering: { selectedCodeBlock: block },
		});
		const { draw, context } = createDrawingContext(state, block);
		drawCaret(context);
		// A tab reaches column 4; the following character reaches 5, plus four gutter cells.
		expect(draw.drawText).toHaveBeenLastCalledWith(72, 96, '_', PALETTE_INDICES.inkBase);
		state.viewport.vGrid = 12;
		block.cursor.y = 144;
		drawCaret(context);
		expect(draw.drawText).toHaveBeenLastCalledWith(108, 144, '_', PALETTE_INDICES.inkBase);
		block.code = ['; @tab 8', '\tvalue'];
		drawCaret(context);
		expect(draw.drawText).toHaveBeenLastCalledWith(156, 144, '_', PALETTE_INDICES.inkBase);
		block.code[0] = '; @tab 16';
		block.parsedDirectives = parseBlockDirectives(block.code);
		drawCaret(context);
		expect(draw.drawText).toHaveBeenLastCalledWith(252, 144, '_', PALETTE_INDICES.inkBase);
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
