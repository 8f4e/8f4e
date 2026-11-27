import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { expect, it } from 'vitest';
import initState, { EMPTY_DEFAULT_PROJECT, insertCodeBlock, setGridSize, updateViewport } from '~/index';
import { createEvents } from './__tests__/events';

it('assigns inserted source to the containing entry without a presentation plugin', () => {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	const state = store.getState();
	try {
		events.dispatch('loadProject', {
			project: {
				...EMPTY_DEFAULT_PROJECT,
				entries: ['audio'],
				execution: [{ type: 'module', id: 0, entry: 'audio', code: ['module existing', '; @pos 12 8', 'moduleEnd'] }],
			},
		});
		events.dispatch('enterEditMode');
		updateViewport(state, 24, 32, events);
		insertCodeBlock(store, { x: 16, y: 48, code: ['module added', 'moduleEnd'] });
		expect(state.project.activeLevel.blocks.at(-1)!.entry).toBe('audio');
		insertCodeBlock(store, { x: 780, y: 390, code: ['module outside', 'moduleEnd'] });
		expect(state.project.activeLevel.blocks.find(block => block.name === 'outside')!.entry).toBe('entry');
	} finally {
		store.dispose();
	}
});
