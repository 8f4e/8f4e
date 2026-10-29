import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import { createMockCodeBlock, createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { assertionMarkersPlugin } from './index';

describe('assertion markers plugin', () => {
	it('draws current results and layout, and unregisters its drawer on disposal', () => {
		const drawers = createCodeBlockDrawerRegistry();
		const events = createMockEventDispatcher();
		const store = initState(events, { callbacks: {} });
		const dispose = assertionMarkersPlugin.setup({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
			drawers,
		});
		const codeBlock = createMockCodeBlock({
			creationIndex: 7,
			blockType: 'module',
			lineNumberColumnWidth: 2,
			code: ['module checks', 'push 1', 'assert', 'moduleEnd'],
		});
		const state = createMockState();
		const draw = { drawFill: vi.fn() } as unknown as DrawContext;
		const render = () => drawers.drawCodeBlock({ draw, state, codeBlock, memoryViews: {} as MemoryViews });
		render();
		expect(draw.drawFill).not.toHaveBeenCalled();
		state.assertionResults = [
			{
				site: {
					siteId: 0,
					instruction: 'assert',
					projectBlockId: 7,
					projectGroupPath: '',
					codeBlockType: 'module',
					codeBlockId: 'checks',
					lineNumber: 2,
				},
				passed: true,
			},
		];
		render();
		expect(draw.drawFill).toHaveBeenLastCalledWith(8, 32, PALETTE_INDICES.positiveBase, 16, 16);
		state.assertionResults[0].passed = false;
		state.viewport.hGrid = 20;
		state.viewport.vGrid = 10;
		codeBlock.gaps.set(1, { size: 2 });
		render();
		expect(draw.drawFill).toHaveBeenLastCalledWith(10, 80, PALETTE_INDICES.negativeBase, 20, 20);
		for (const hide of [
			() => {
				state.compiler.isCompiling = true;
			},
			() => {
				state.compiler.isCompiling = false;
				codeBlock.disabled = true;
			},
			() => {
				codeBlock.disabled = false;
				state.assertionResults = [];
			},
		]) {
			hide();
			vi.mocked(draw.drawFill).mockClear();
			render();
			expect(draw.drawFill).not.toHaveBeenCalled();
		}
		state.assertionResults = [
			{
				site: {
					siteId: 1,
					instruction: 'assert',
					projectBlockId: 7,
					projectGroupPath: '',
					codeBlockType: 'module',
					codeBlockId: 'checks',
					lineNumber: 2,
				},
				passed: true,
			},
		];
		dispose();
		render();
		expect(draw.drawFill).not.toHaveBeenCalled();
		store.dispose();
	});
});
