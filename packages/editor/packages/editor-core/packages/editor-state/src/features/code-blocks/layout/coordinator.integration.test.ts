import { EventEmitter } from 'node:events';
import type { CodeBlockLayoutsChangedEvent, State } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, expect, it } from 'vitest';
import initState, { applyCodeBlockSourceEdits, deleteCodeBlocks, insertCodeBlocks } from '../../../index';
import updateViewport from '../../viewport/updateViewport';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(onCompleted: (event: CodeBlockLayoutsChangedEvent) => void = () => {}) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	// Register before core: completed geometry must not depend on subscription order.
	events.on('codeBlockLayoutsChanged', onCompleted);
	const store = initState(events, { callbacks: {} });
	cleanups.push(store.dispose);
	events.dispatch('resize', { canvasWidth: 1024, canvasHeight: 768 });
	const load = (source: string) => events.dispatch('loadProject', { project: parseProjectSource(source) });
	return { store, state: store.getState(), events, load };
}

it('finishes world-space layout before notifying observers, including late contribution and source updates', () => {
	let state: State;
	let notifications = 0;
	const test = setup(({ project, codeBlocks }) => {
		for (const block of codeBlocks) {
			if (block.name !== 'world') continue;
			notifications++;
			expect(project).toBe(state.codeBlockRendering.currentProject);
			expect(block.x).toBe(2 * state.viewport.vGrid);
			expect(block.y).toBe(3 * state.viewport.hGrid);
		}
	});
	state = test.state;
	test.load('8f4e/v1\nnote world\n; @pos 2 3\ncontent\nnoteEnd');
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'world')!;
	const contribution = test.store.layout.createContribution();
	const unsubscribe = test.store.layout.subscribe(({ codeBlock }) => {
		if (codeBlock === block) {
			contribution.update(block, {
				minGridWidth: 48,
				verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }],
			});
		}
	});
	cleanups.push(contribution.dispose, unsubscribe);
	expect(block.width).toBe(48 * state.viewport.vGrid);
	applyCodeBlockSourceEdits({ store: test.store, events: test.events }, [
		{ codeBlock: block, code: [...block.code.slice(0, -1), 'another line', 'noteEnd'] },
	]);
	expect(notifications).toBeGreaterThanOrEqual(3);
});

it('keeps group ownership and world-space layout across navigation and renaming', () => {
	const completed: CodeBlockLayoutsChangedEvent[] = [];
	const test = setup(event => completed.push(event));
	test.load(`8f4e/v1
note root
; @pos 2 3
root content
noteEnd
entry main
group child
note nested
; @pos 1 2
nested content
noteEnd
groupEnd
entryEnd`);
	const root = test.state.codeBlockRendering.currentProject;
	const rootBlock = root.blocks.find(block => block.name === 'root')!;
	const group = root.blocks.find(block => block.childProject)!;
	const child = group.childProject!;
	const nested = child.blocks[0];
	test.events.dispatch('openProjectGroup', { codeBlock: group });
	updateViewport(test.state, 160, 320, test.events);
	test.events.dispatch('goToRootProjectGroup');
	const rootPosition = { x: rootBlock.x, y: rootBlock.y };
	const entryBounds = test.state.codeBlockRendering.entryBounds;
	const contribution = test.store.layout.createContribution();
	cleanups.push(contribution.dispose);
	completed.length = 0;
	contribution.update(nested, { minGridWidth: 48, verticalSpaceAfterSourceLine: [] });
	expect(completed).toEqual([{ project: child, codeBlocks: [nested] }]);
	const { vGrid, hGrid } = test.state.viewport;
	expect(nested).toMatchObject({ x: vGrid, y: 2 * hGrid, width: 48 * vGrid });
	expect(rootBlock).toMatchObject(rootPosition);
	expect(test.state.codeBlockRendering.entryBounds).toBe(entryBounds);
	applyCodeBlockSourceEdits({ store: test.store, events: test.events }, [
		{ codeBlock: group, code: ['group renamed', 'groupEnd'] },
	]);
	expect(child.path).toBe('renamed');
	expect(nested.projectPath).toBe('renamed');
	completed.length = 0;
	contribution.update(nested, { minGridWidth: 49, verticalSpaceAfterSourceLine: [] });
	expect(completed).toEqual([{ project: child, codeBlocks: [nested] }]);
	test.events.dispatch('openProjectGroup', { codeBlock: group });
	expect(test.state.viewport).toMatchObject({ x: 160, y: 320 });
	expect(completed.at(-1)?.project).toBe(child);
});

it('registers pasted nested blocks and drops ownership when their group is deleted', () => {
	const completed: CodeBlockLayoutsChangedEvent[] = [];
	const test = setup(event => completed.push(event));
	test.load('8f4e/v1');
	test.events.dispatch('enterEditMode');
	insertCodeBlocks(test.store, {
		x: 0,
		y: 0,
		blocks: [
			{
				code: ['group pasted', 'groupEnd'],
				gridCoordinates: { x: 0, y: 0 },
				childProject: {
					entries: [],
					blocks: [{ code: ['note nested', 'content', 'noteEnd'], gridCoordinates: { x: 0, y: 0 } }],
				},
			},
		],
	});
	const group = test.state.codeBlockRendering.currentProject.blocks.find(block => block.childProject)!;
	const child = group.childProject!;
	const nested = child.blocks[0];
	const contribution = test.store.layout.createContribution();
	cleanups.push(contribution.dispose);
	completed.length = 0;
	contribution.update(nested, { minGridWidth: 48, verticalSpaceAfterSourceLine: [] });
	expect(completed).toEqual([{ project: child, codeBlocks: [nested] }]);
	deleteCodeBlocks(test.store, [group]);
	completed.length = 0;
	contribution.remove(nested);
	expect(completed).toEqual([]);
});

it('announces an empty group when navigation replaces the visible project slice', () => {
	const completed: CodeBlockLayoutsChangedEvent[] = [];
	const test = setup(event => completed.push(event));
	test.load('8f4e/v1\nentry main\ngroup empty\ngroupEnd\nentryEnd');
	const group = test.state.codeBlockRendering.currentProject.blocks.find(block => block.childProject)!;
	completed.length = 0;
	test.events.dispatch('openProjectGroup', { codeBlock: group });
	expect(completed).toContainEqual({ project: group.childProject, codeBlocks: [] });
});

it('settles dependent contributions across groups before publishing separate completion batches', () => {
	const completed: CodeBlockLayoutsChangedEvent[] = [];
	const test = setup(event => completed.push(event));
	test.load(
		'8f4e/v1\nnote first\nroot content\nnoteEnd\nentry main\ngroup child\nnote second\nchild content\nnoteEnd\ngroupEnd\nentryEnd'
	);
	const root = test.state.codeBlockRendering.currentProject;
	const first = root.blocks.find(block => block.name === 'first')!;
	const child = root.blocks.find(block => block.childProject)!.childProject!;
	const second = child.blocks[0];
	const contribution = test.store.layout.createContribution();
	const dependent = test.store.layout.createContribution();
	let updateDependent = false;
	const unsubscribe = test.store.layout.subscribe(({ codeBlock }) => {
		if (updateDependent && codeBlock === first) {
			dependent.update(second, { minGridWidth: 48, verticalSpaceAfterSourceLine: [] });
		}
	});
	cleanups.push(contribution.dispose, dependent.dispose, unsubscribe);
	completed.length = 0;
	updateDependent = true;
	contribution.update(first, { minGridWidth: 40, verticalSpaceAfterSourceLine: [] });
	expect(completed).toEqual([
		{ project: root, codeBlocks: [first] },
		{ project: child, codeBlocks: [second] },
	]);
	expect(second.width).toBe(48 * test.state.viewport.vGrid);
});

it('keeps blocks in world coordinates when the viewport pans or resizes', () => {
	const completed: CodeBlockLayoutsChangedEvent[] = [];
	const test = setup(event => completed.push(event));
	test.load('8f4e/v1\nnote world\n; @pos 2 3\ncontent\nnoteEnd');
	const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'world')!;
	const { vGrid, hGrid } = test.state.viewport;
	expect(block).toMatchObject({ x: 2 * vGrid, y: 3 * hGrid });
	completed.length = 0;
	updateViewport(test.state, 163, 325, test.events);
	test.events.dispatch('resize', { canvasWidth: 435, canvasHeight: 217 });
	expect(block).toMatchObject({ x: 2 * vGrid, y: 3 * hGrid });
	expect(completed).toEqual([]);
});
