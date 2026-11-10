import { EventEmitter } from 'node:events';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { textToGlyphIds } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDrawingContext } from './__tests__/drawing';
import createCaretPresentation from './drawCaret';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(state: State, block: CodeBlockGraphicData) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const presentation = createCaretPresentation(state, events);
	cleanups.push(presentation.dispose);
	return { state, ...createDrawingContext(state, block), presentation, events, emitter };
}

describe('editing caret presentation', () => {
	it.each([
		[false, PALETTE_INDICES.inkBase],
		[true, PALETTE_INDICES.inkFaint],
	] as const)('prepares horizontal placement on installation with disabled=%s', (disabled, color) => {
		const block = createMockCodeBlock({ code: ['module test', 'push 1'], disabled, cursor: { row: 1, col: 2, y: 48 } });
		const state = createMockState({ editorMode: 'edit', codeBlockRendering: { selectedCodeBlock: block } });
		const { draw, context, presentation } = setup(state, block);
		presentation.drawCaret(context);
		expect(draw.drawGlyphs).toHaveBeenCalledWith(40, 48, textToGlyphIds('_'), color);
	});

	it('updates prepared placement for source, cursor, gutter, and grid changes after layout', () => {
		const block = createMockCodeBlock({
			code: ['; @tab 4 12', '\tvalue'],
			lineNumberColumnWidth: 2,
			cursor: { row: 1, col: 2, y: 96 },
		});
		const state = createMockState({ editorMode: 'edit', codeBlockRendering: { selectedCodeBlock: block } });
		const { draw, context, presentation, events } = setup(state, block);
		presentation.drawCaret(context);
		// A tab reaches column 4; the following character reaches 5, plus four gutter cells.
		expect(draw.drawGlyphs).toHaveBeenLastCalledWith(72, 96, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
		state.viewport.vGrid = 12;
		block.cursor.y = 144;
		events.dispatch('codeBlockLayoutsChanged', {
			project: state.codeBlockRendering.currentProject,
			codeBlocks: [block],
		});
		presentation.drawCaret(context);
		expect(draw.drawGlyphs).toHaveBeenLastCalledWith(108, 144, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
		block.code = ['; @tab 8', '\tvalue'];
		events.dispatch('codeBlockLayoutsChanged', {
			project: state.codeBlockRendering.currentProject,
			codeBlocks: [block],
		});
		presentation.drawCaret(context);
		expect(draw.drawGlyphs).toHaveBeenLastCalledWith(156, 144, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
		block.code[0] = '; @tab 16';
		block.cursor.col = 1;
		block.lineNumberColumnWidth = 3;
		events.dispatch('codeBlockLayoutsChanged', {
			project: state.codeBlockRendering.currentProject,
			codeBlocks: [block],
		});
		presentation.drawCaret(context);
		expect(draw.drawGlyphs).toHaveBeenLastCalledWith(252, 144, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
	});

	it('draws repeated unchanged frames without reading source and removes preparation on disposal', () => {
		const code = ['; @tab 4', '\tvalue'];
		const block = createMockCodeBlock({ code, cursor: { row: 1, col: 2, y: 16 } });
		const readSource = vi.fn(() => code);
		Object.defineProperty(block, 'code', { get: readSource });
		const state = createMockState({ editorMode: 'edit', codeBlockRendering: { selectedCodeBlock: block } });
		const { draw, context, presentation, events, emitter } = setup(state, block);
		expect(readSource).toHaveBeenCalled();
		readSource.mockClear();
		for (let frame = 0; frame < 5; frame++) presentation.drawCaret(context);
		expect(draw.drawGlyphs).toHaveBeenCalledTimes(5);
		expect(draw.drawGlyphs).toHaveBeenLastCalledWith(64, 16, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
		expect(readSource).not.toHaveBeenCalled();
		block.cursor.col = 3;
		events.dispatch('codeBlockLayoutsChanged', {
			project: state.codeBlockRendering.currentProject,
			codeBlocks: [block],
		});
		expect(readSource).toHaveBeenCalled();
		readSource.mockClear();
		presentation.drawCaret(context);
		expect(draw.drawGlyphs).toHaveBeenLastCalledWith(72, 16, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
		expect(readSource).not.toHaveBeenCalled();
		presentation.dispose();
		expect(emitter.listenerCount('codeBlockLayoutsChanged')).toBe(0);
		events.dispatch('codeBlockLayoutsChanged', {
			project: state.codeBlockRendering.currentProject,
			codeBlocks: [block],
		});
		expect(readSource).not.toHaveBeenCalled();
	});

	it('keeps prepared positions and disposal independent between editor instances', () => {
		const firstBlock = createMockCodeBlock({ code: ['first'], cursor: { row: 0, col: 1, y: 0 } });
		const secondBlock = createMockCodeBlock({ code: ['second'], cursor: { row: 0, col: 4, y: 32 } });
		const first = setup(
			createMockState({ editorMode: 'edit', codeBlockRendering: { selectedCodeBlock: firstBlock } }),
			firstBlock
		);
		const second = setup(
			createMockState({ editorMode: 'edit', codeBlockRendering: { selectedCodeBlock: secondBlock } }),
			secondBlock
		);
		first.presentation.drawCaret(first.context);
		expect(first.draw.drawGlyphs).toHaveBeenLastCalledWith(32, 0, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
		second.presentation.drawCaret(second.context);
		expect(second.draw.drawGlyphs).toHaveBeenLastCalledWith(56, 32, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
		first.presentation.dispose();
		secondBlock.cursor.col = 2;
		second.events.dispatch('codeBlockLayoutsChanged', {
			project: second.state.codeBlockRendering.currentProject,
			codeBlocks: [secondBlock],
		});
		second.presentation.drawCaret(second.context);
		expect(second.draw.drawGlyphs).toHaveBeenLastCalledWith(40, 32, textToGlyphIds('_'), PALETTE_INDICES.inkBase);
	});

	it('does not reread the selected source after an unrelated block completes its layout', () => {
		const block = createMockCodeBlock({ code: ['selected'], cursor: { row: 0, col: 1, y: 0 } });
		const readSource = vi.fn(() => ['selected']);
		Object.defineProperty(block, 'code', { get: readSource });
		const state = createMockState({ editorMode: 'edit', codeBlockRendering: { selectedCodeBlock: block } });
		const { events } = setup(state, block);
		readSource.mockClear();
		events.dispatch('codeBlockLayoutsChanged', {
			project: state.codeBlockRendering.currentProject,
			codeBlocks: [createMockCodeBlock()],
		});
		expect(readSource).not.toHaveBeenCalled();
	});

	it('does not draw in view mode', () => {
		const block = createMockCodeBlock();
		const state = createMockState({ editorMode: 'view', codeBlockRendering: { selectedCodeBlock: block } });
		const { draw, context, presentation } = setup(state, block);
		presentation.drawCaret(context);
		expect(draw.drawGlyphs).not.toHaveBeenCalled();
	});

	it('does not draw for an unselected block', () => {
		const block = createMockCodeBlock();
		const state = createMockState({ editorMode: 'edit' });
		const { draw, context, presentation } = setup(state, block);
		presentation.drawCaret(context);
		expect(draw.drawGlyphs).not.toHaveBeenCalled();
	});
});
