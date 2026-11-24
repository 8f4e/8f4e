import { EventEmitter } from 'node:events';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { expect, it, vi } from 'vitest';
import initState, { EMPTY_DEFAULT_PROJECT, insertCodeBlock, serializeToProject, setGridSize } from '../index';

it('returns the created block after entry assignment, source preparation and layout settle', () => {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	try {
		events.dispatch('loadProject', { project: { ...EMPTY_DEFAULT_PROJECT } });
		events.dispatch('enterEditMode');
		const block = insertCodeBlock(store, {
			x: 80,
			y: 64,
			code: ['module added', '; @tab 40', '\tvalue', 'moduleEnd'],
		})!;
		const state = store.getState();
		expect(state.codeBlockRendering.currentProject.blocks).toContain(block);
		expect(block).toMatchObject({ entry: 'entry', gridX: 10, gridY: 4 });
		expect(block.tabStopsByLine).toEqual([[], [], [40], [40], [40]]);
		expect(block.width).toBe(51 * state.viewport.vGrid);
		expect(block.height).toBe(5 * state.viewport.hGrid);
	} finally {
		store.dispose();
	}
});

it.each(['disabled', 'customDisabled'])(
	'settles @%s through the source-update path before publishing insertion',
	directive => {
		const emitter = new EventEmitter();
		const events = {
			on: emitter.on.bind(emitter),
			off: emitter.off.bind(emitter),
			dispatch: emitter.emit.bind(emitter),
		};
		const store = initState(events, { callbacks: {} });
		const unregister = store.directives.register({
			name: 'customDisabled',
			apply: (_, draft) => {
				draft.blockState.disabled = true;
			},
		});
		const state = store.getState();
		setGridSize(state, events, TEST_GRID_SIZE);
		try {
			events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
			events.dispatch('enterEditMode');
			const changed = vi.fn(() => serializeToProject(state));
			store.subscribe('compilerInputRevision', changed);
			const block = insertCodeBlock(store, {
				x: 80,
				y: 64,
				code: ['module inserted', `; @${directive}`, 'moduleEnd'],
			})!;
			expect(block.disabled).toBe(true);
			expect(changed).toHaveBeenCalledOnce();
			const module = changed.mock.results[0].value.execution.find(entry => entry.id === block.creationIndex);
			expect(module).toMatchObject({ disabled: true, code: block.code });
		} finally {
			unregister();
			store.dispose();
		}
	}
);
