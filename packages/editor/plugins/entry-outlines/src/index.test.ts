import type { EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { ResolveCodeBlockInsertionEntryEvent } from '@8f4e/editor-state';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { entryOutlinesPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const block = createMockCodeBlock({ blockType: 'module', entry: 'audio', x: 80, y: 128, width: 96, height: 64 });
	const state = createMockState({ codeBlockRendering: { currentProject: { blocks: [block] } } });
	const store = createStateManager(state);
	const events = createEvents();
	const drawers = createEditorDrawerRegistry();
	const dispose = entryOutlinesPlugin.setup({ store, events, drawers } as unknown as EditorPluginContext);
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawText: vi.fn() };
	const render = () => {
		for (const method of Object.values(draw)) method.mockClear();
		drawers.drawCanvasBackground({ draw: draw as unknown as DrawContext, state, memoryViews: {} as MemoryViews });
	};
	const resolveEntry = (x: number, y: number) => {
		const request: ResolveCodeBlockInsertionEntryEvent = { x, y, entry: 'new-entry' };
		events.dispatch('resolveCodeBlockInsertionEntry', request);
		return request.entry;
	};
	return { block, state, store, events, drawers, draw, render, resolveEntry, dispose };
}

it('draws padded entry outlines and labels in world coordinates', () => {
	const test = setup();
	test.state.viewport.x = 24;
	test.state.viewport.y = 32;
	test.render();
	expect(test.draw.startGroup).toHaveBeenCalledExactlyOnceWith(-24, -32);
	expect(test.draw.drawFill.mock.calls).toEqual([
		[16, 64, PALETTE_INDICES.strokeBase, 224, 1],
		[16, 255, PALETTE_INDICES.strokeBase, 224, 1],
		[16, 64, PALETTE_INDICES.strokeBase, 1, 192],
		[239, 64, PALETTE_INDICES.strokeBase, 1, 192],
	]);
	expect(test.draw.drawText).toHaveBeenCalledExactlyOnceWith(24, 64, 'audio', PALETTE_INDICES.inkStrong);
});

it('chooses the first containing entry, includes its edges, and leaves outside defaults unchanged', () => {
	const test = setup();
	test.store.set('codeBlockRendering.currentProject.blocks', [
		test.block,
		createMockCodeBlock({ blockType: 'module', entry: 'second', x: 80, y: 128, width: 96, height: 64 }),
	]);
	for (const [x, y] of [
		[16, 64],
		[240, 256],
		[100, 150],
	]) {
		expect(test.resolveEntry(x, y)).toBe('audio');
	}
	expect(test.resolveEntry(15, 100)).toBe('new-entry');
	expect(test.resolveEntry(100, 257)).toBe('new-entry');
});

it('refreshes after layout, grid, and completed project changes', () => {
	const test = setup();
	test.block.width = 200;
	test.events.dispatch('codeBlockLayoutsChanged');
	expect(test.resolveEntry(300, 150)).toBe('audio');
	test.state.viewport.vGrid = 4;
	test.state.viewport.hGrid = 8;
	test.events.dispatch('gridSizeChanged');
	expect(test.resolveEntry(16, 64)).toBe('new-entry');
	test.block.x = 400;
	test.block.entry = 'changed';
	test.store.set('projectChange', { revision: 1, kind: 'edit' });
	expect(test.resolveEntry(400, 128)).toBe('changed');
	test.render();
	expect(test.draw.drawText).toHaveBeenCalledExactlyOnceWith(372, 96, 'changed', PALETTE_INDICES.inkStrong);
});

it.each(['viewportChanged', 'viewportResized'])('refreshes moved viewport-anchored geometry after %s', event => {
	const test = setup();
	test.block.viewportAnchor = 'top-left';
	test.block.x = 600;
	test.events.dispatch(event);
	expect(test.resolveEntry(600, 150)).toBe('audio');
	expect(test.resolveEntry(80, 150)).toBe('new-entry');
});

it('replaces the outline set when navigating to another project level', () => {
	const test = setup();
	const root = test.state.codeBlockRendering.currentProject;
	test.store.set('codeBlockRendering.currentProject', {
		path: 'nested',
		entries: ['child'],
		blocks: [createMockCodeBlock({ blockType: 'module', entry: 'child', x: 400, y: 200 })],
	});
	expect(test.resolveEntry(80, 150)).toBe('new-entry');
	expect(test.resolveEntry(400, 200)).toBe('child');
	test.store.set('codeBlockRendering.currentProject', root);
	expect(test.resolveEntry(80, 150)).toBe('audio');
});

it('isolates installations and unregisters drawing, insertion policy, and geometry subscriptions', () => {
	const first = setup();
	const second = setup();
	const unsubscribe = vi.spyOn(first.store, 'unsubscribe');
	const off = vi.spyOn(first.events, 'off');
	first.dispose();
	first.render();
	second.render();
	expect(first.draw.drawFill).not.toHaveBeenCalled();
	expect(second.draw.drawFill).toHaveBeenCalledTimes(4);
	expect(first.resolveEntry(80, 150)).toBe('new-entry');
	expect(second.resolveEntry(80, 150)).toBe('audio');
	expect(unsubscribe.mock.calls.map(([selector]) => selector)).toEqual([
		'codeBlockRendering.currentProject.blocks',
		'projectChange',
	]);
	expect(off.mock.calls.map(([event]) => event)).toEqual([
		'codeBlockLayoutsChanged',
		'gridSizeChanged',
		'viewportChanged',
		'viewportResized',
		'resolveCodeBlockInsertionEntry',
	]);
});
