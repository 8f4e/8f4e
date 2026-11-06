import createStateManager from '@8f4e/state-manager';
import { expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createEvents } from './__tests__/events';
import entryBounds from './effect';

function setup() {
	const block = createMockCodeBlock({ blockType: 'module', entry: 'audio', x: 80, y: 128, width: 96, height: 64 });
	const state = createMockState({ codeBlockRendering: { currentProject: { blocks: [block] } } });
	const store = createStateManager(state);
	const events = createEvents();
	const dispose = entryBounds(store, events);
	return { block, state, store, events, dispose };
}

it('refreshes entry bounds after layout, grid, and completed project changes', () => {
	const test = setup();
	try {
		expect(test.state.codeBlockRendering.entryBounds).toEqual([
			{ entryName: 'audio', x: 16, y: 64, width: 224, height: 192 },
		]);
		test.block.width = 200;
		test.events.dispatch('codeBlockLayoutsChanged', { codeBlocks: [test.block] });
		expect(test.state.codeBlockRendering.entryBounds[0].width).toBe(328);
		test.state.viewport.vGrid = 4;
		test.state.viewport.hGrid = 8;
		test.events.dispatch('gridSizeChanged');
		expect(test.state.codeBlockRendering.entryBounds).toEqual([
			{ entryName: 'audio', x: 48, y: 96, width: 264, height: 128 },
		]);
		test.block.x = 400;
		test.block.entry = 'changed';
		test.store.set('projectChange', { revision: 1, kind: 'edit' });
		expect(test.state.codeBlockRendering.entryBounds[0]).toMatchObject({ entryName: 'changed', x: 368 });
	} finally {
		test.dispose();
		test.store.dispose();
	}
});

it.each(['viewportChanged', 'viewportResized'])('refreshes moved viewport-anchored geometry after %s', event => {
	const test = setup();
	try {
		test.block.viewportAnchor = 'top-left';
		test.block.x = 600;
		test.events.dispatch(event);
		expect(test.state.codeBlockRendering.entryBounds[0].x).toBe(536);
	} finally {
		test.dispose();
		test.store.dispose();
	}
});

it('replaces entry bounds when navigating between project levels', () => {
	const test = setup();
	try {
		const root = test.state.codeBlockRendering.currentProject;
		test.store.set('codeBlockRendering.currentProject', {
			path: 'nested',
			entries: ['child'],
			blocks: [createMockCodeBlock({ blockType: 'module', entry: 'child', x: 400, y: 200 })],
		});
		expect(test.state.codeBlockRendering.entryBounds).toHaveLength(1);
		expect(test.state.codeBlockRendering.entryBounds[0]).toMatchObject({ entryName: 'child', x: 336 });
		test.store.set('codeBlockRendering.currentProject', root);
		expect(test.state.codeBlockRendering.entryBounds[0]).toMatchObject({ entryName: 'audio', x: 16 });
	} finally {
		test.dispose();
		test.store.dispose();
	}
});

it('stops reacting to store and geometry notifications after disposal', () => {
	const test = setup();
	try {
		const previous = test.state.codeBlockRendering.entryBounds;
		test.dispose();
		test.block.x = 500;
		test.store.set('projectChange', { revision: 1, kind: 'edit' });
		test.store.set('codeBlockRendering.currentProject.blocks', []);
		test.events.dispatch('codeBlockLayoutsChanged', { codeBlocks: [test.block] });
		test.events.dispatch('gridSizeChanged');
		test.events.dispatch('viewportChanged');
		test.events.dispatch('viewportResized');
		expect(test.state.codeBlockRendering.entryBounds).toBe(previous);
	} finally {
		test.store.dispose();
	}
});
