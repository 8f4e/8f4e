import { EventEmitter } from 'node:events';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createWebUiRenderProjection, type WebUiRenderData } from '@8f4e/web-ui-render-projection';
import { afterEach, expect, it } from 'vitest';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, entry: 'main', code: ['module audio', 'int value 0', 'moduleEnd'] }],
		},
	});
	const projection = createWebUiRenderProjection(store, events);
	const block = store.getState().codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
	cleanups.push(() => {
		projection.dispose();
		store.dispose();
	});
	const completed: WebUiRenderData[] = [];
	events.on('codeBlockLayoutsChanged', () => completed.push(projection.getSnapshot()));
	return { store, events, projection, block, completed };
}

it('keeps the completed render snapshot when diagnostics finish updating layout', () => {
	const { store, projection, block, completed } = setup();
	store.set('codeErrors.compilationErrors', [{ codeBlockId: block.creationIndex, lineNumber: 1, message: 'Example' }]);
	expect(completed).toHaveLength(1);
	expect(projection.getSnapshot()).toBe(completed[0]);
});

it.each(['memoryValuesChanged', 'spriteSheetRerendered'])('keeps the completed render snapshot after %s', event => {
	const { events, projection, completed } = setup();
	events.dispatch(event);
	expect(completed).toHaveLength(1);
	expect(projection.getSnapshot()).toBe(completed[0]);
});

it('updates text and reserved rows after source edits and late layout contributions', () => {
	const { store, projection, block } = setup();
	const contribution = store.layout.createContribution();
	cleanups.push(contribution.dispose);
	contribution.update(block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
	const before = projection.getSnapshot().codeBlocks.get(block.creationIndex)!.codeCells;
	expect(before).toHaveLength(5);
	applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: ['module audio', 'int value 1', 'moduleEnd'] }], {
		affectsCompilation: true,
	});
	const after = projection.getSnapshot().codeBlocks.get(block.creationIndex)!.codeCells;
	expect(after).toHaveLength(5);
	expect(after).not.toEqual(before);
});

it('retains render data for info and dragging updates that do not change layout', () => {
	const { store, projection, block } = setup();
	const before = projection.getSnapshot();
	store.set('info.graphics', { fps: 60 });
	store.set('codeBlockRendering.draggedCodeBlock', block);
	expect(projection.getSnapshot()).toBe(before);
});
