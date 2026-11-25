import { EventEmitter } from 'node:events';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState, { setGridSize } from '~/index';
import { EMPTY_DEFAULT_PROJECT } from '~/project/emptyDefaultProject';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events: EventDispatcher = {
		on: emitter.on.bind(emitter),
		off: emitter.off.bind(emitter),
		dispatch: emitter.emit.bind(emitter),
	};
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	cleanups.push(store.dispose);
	events.dispatch('resize', { canvasWidth: 200, canvasHeight: 200 });
	setGridSize(state, events, { vGrid: 8, hGrid: 16 });
	const load = (project: ProjectObjectModel) => events.dispatch('loadProject', { project });
	const loadSource = (source: string) => load(parseProjectSource(`8f4e/v1\n${source}`));
	const block = (name: string) => state.project.activeLevel.blocks.find(block => block.name === name)!;
	return { store, state, events, load, loadSource, block };
}

describe('pointer caret selection', () => {
	it.each(['view', 'edit'] as const)('updates shared source selection through the store in %s mode', editorMode => {
		const { store, state, events, load } = setup();
		load(EMPTY_DEFAULT_PROJECT);
		const {
			insertedBlocks: [selectedBlock],
		} = store.projectTransactions.apply({
			inserts: [{ targetLevel: state.project.rootLevel, source: { code: ['; @tab 4', '\tvalue', 'two'] } }],
		});
		if (editorMode === 'edit') events.dispatch('enterEditMode');
		store.set('project.selectedCodeBlock', selectedBlock);
		const onSelectedRowChanged = vi.fn();
		store.subscribe('project.selectedCodeBlock.cursor.row', onSelectedRowChanged);

		events.dispatch('codeBlockPointerDown', {
			relativeX: 8 * 8,
			relativeY: state.viewport.hGrid,
			codeBlock: selectedBlock,
		});

		expect(state.editorMode).toBe(editorMode);
		expect(selectedBlock.cursor).toEqual({ row: 1, col: 2, y: 16 });
		expect(onSelectedRowChanged).toHaveBeenCalledWith(1);
	});

	it('keeps folded source selection and gap geometry available without an editing plugin', () => {
		const { store, state, events, loadSource, block } = setup();
		loadSource('note test\n; @hide\n; @tab 4\n\tvalue\nnoteEnd');
		const note = block('test');
		expect(note.isCollapsed).toBe(true);
		const contribution = store.layout.createContribution();
		cleanups.push(contribution.dispose);
		contribution.update(note, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }] });
		store.set('project.selectedCodeBlock', note);
		expect(note.isCollapsed).toBe(false);
		setGridSize(state, events, { vGrid: 12, hGrid: 24 });
		events.dispatch('codeBlockPointerDown', { codeBlock: note, relativeX: 96, relativeY: 132 });
		expect(note.cursor).toEqual({ row: 3, col: 2, y: 120 });
		expect(state.editorMode).toBe('view');
	});
});
