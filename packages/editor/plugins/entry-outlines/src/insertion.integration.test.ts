import initState, { EMPTY_DEFAULT_PROJECT, updateViewport } from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { expect, it } from 'vitest';
import { createEvents } from './__tests__/events';
import { entryOutlinesPlugin } from './index';

it('assigns inserted modules to containing entries in world space and preserves outside defaults', () => {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	const dispose = entryOutlinesPlugin.setup({
		store,
		events,
		drawers: createEditorDrawerRegistry(),
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
	});
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
		expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'added')!.entry).toBe('audio');
		events.dispatch('insertCodeBlock', { x: 780, y: 390, code: ['module outside', 'moduleEnd'] });
		expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'outside')!.entry).toBe('entry');
	} finally {
		dispose();
		store.dispose();
	}
});
