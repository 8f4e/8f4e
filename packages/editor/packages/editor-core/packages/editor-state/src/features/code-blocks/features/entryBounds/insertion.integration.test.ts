import { expect, it } from 'vitest';
import initState, { EMPTY_DEFAULT_PROJECT, updateViewport } from '~/index';
import { createEvents } from './__tests__/events';

it('assigns inserted source to the containing entry without a presentation plugin', () => {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
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
		events.dispatch('insertCodeBlock', { x: 16, y: 48, code: ['module added', 'moduleEnd'] });
		expect(state.codeBlockRendering.currentProject.blocks.at(-1)!.entry).toBe('audio');
		events.dispatch('insertCodeBlock', { x: 780, y: 390, code: ['module outside', 'moduleEnd'] });
		expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'outside')!.entry).toBe('entry');
	} finally {
		store.dispose();
	}
});
