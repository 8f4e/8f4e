import { EventEmitter } from 'node:events';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it } from 'vitest';
import initState, { markGridSizePending, setGridSize, updateViewport } from '~/index';
import type { ResolveCodeBlockDragTargetsEvent } from './effect';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function moduleSource(name: string, x: number, y: number, ...directives: string[]): string {
	return [`module ${name}`, `; @pos ${x} ${y}`, ...directives, 'moduleEnd'].join('\n');
}

function projectSource(...blocks: string[]): string {
	// Keep the generated environment block out of the interaction area.
	return ['8f4e/v1', 'constants env', '; @pos -100 -100', 'constantsEnd', 'entry main', ...blocks, 'entryEnd'].join(
		'\n'
	);
}

const firstSource = moduleSource('first', 5, 5);
const secondSource = moduleSource('second', 20, 10);

function setup(source = projectSource(firstSource), { moduleDragging = true, mode = 'edit' } = {}) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	// This dispatcher has no input layers, so isolate dragging from viewport panning.
	const store = initState(events, { callbacks: {}, featureFlags: { moduleDragging, viewportDragging: false } });
	cleanups.push(store.dispose);
	const state = store.getState();
	events.dispatch('resize', { canvasWidth: 800, canvasHeight: 600 });
	setGridSize(state, events, { vGrid: 10, hGrid: 20 });
	const load = (source: string) => {
		events.dispatch('loadProject', { project: parseProjectSource(source) });
		events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	};
	load(source);
	const block = (name: string) => state.codeBlockRendering.currentProject.blocks.find(block => block.name === name)!;
	const visibleNames = () => state.codeBlockRendering.currentProject.blocks.map(block => block.name);
	const pointer = (x: number, y: number, altKey = false) => ({
		x,
		y,
		movementX: 0,
		movementY: 0,
		buttons: 1,
		stopPropagation: false,
		canvasWidth: 800,
		canvasHeight: 600,
		altKey,
	});
	const press = (target: CodeBlockGraphicData, altKey = false) => {
		const event = pointer(target.x - state.viewport.x + 1, target.y - state.viewport.y + 1, altKey);
		events.dispatch('pointerdown', event);
		return event;
	};
	const move = (movementX: number, movementY: number) => {
		const event = { ...pointer(0, 0), movementX, movementY };
		events.dispatch('pointermove', event);
		return event;
	};
	const release = () => events.dispatch('pointerup');
	const selectTargets = (...targets: CodeBlockGraphicData[]) => {
		events.on('resolveCodeBlockDragTargets', (request: ResolveCodeBlockDragTargetsEvent) => {
			request.targets = targets;
		});
	};
	const revision = () => [state.projectChange.revision, state.compilerInputRevision];
	return { store, state, events, load, block, visibleNames, pointer, press, move, release, selectTargets, revision };
}

describe('codeBlockDragger', () => {
	it.each([
		{ x: 0, y: 0 },
		{ x: 3, y: 5 },
	])('drags the clicked block and snaps it to the world grid at viewport ($x, $y)', ({ x, y }) => {
		const test = setup();
		const block = test.block('first');
		updateViewport(test.state, x, y, test.events);
		test.press(block);
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBe(block);
		const move = test.move(10, 10);
		expect(move.stopPropagation).toBe(true);
		expect(block).toMatchObject({ x: 60, y: 110 });
		test.release();
		expect(block).toMatchObject({ x: 60, y: 120, gridX: 6, gridY: 6 });
		expect(block.code).toContain('; @pos 6 6');
		expect(test.state.viewport).toMatchObject({ x, y });
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
	});

	it('discards the drag preview without publishing if the block snaps to its saved position', () => {
		const test = setup();
		const block = test.block('first');
		const before = test.revision();
		const { lastUpdated, code } = block;
		test.press(block);
		test.move(2, 2);
		expect(block).toMatchObject({ x: 52, y: 102, gridX: 5, gridY: 5 });
		test.release();
		expect(block).toMatchObject({ x: 50, y: 100, gridX: 5, gridY: 5, lastUpdated });
		expect(block.code).toBe(code);
		expect(test.revision()).toEqual(before);
	});

	it('moves plugin-selected targets and persists their positions with one change', () => {
		const test = setup(projectSource(firstSource, secondSource));
		const first = test.block('first');
		const second = test.block('second');
		const before = test.revision();
		test.events.on('resolveCodeBlockDragTargets', (request: ResolveCodeBlockDragTargetsEvent) => {
			expect(request).toEqual({ codeBlock: first, altKey: true, targets: [first] });
			request.targets = [first, second];
		});
		test.press(first, true);
		test.move(10, 20);
		test.release();
		expect(first.code).toContain('; @pos 6 6');
		expect(second.code).toContain('; @pos 21 11');
		expect(test.revision()).toEqual(before.map(value => value + 1));
	});

	it('commits only surviving targets when a secondary block is deleted during a drag', () => {
		const test = setup(projectSource(firstSource, secondSource));
		const first = test.block('first');
		const second = test.block('second');
		const before = test.revision();
		test.selectTargets(first, second);
		test.press(first);
		test.move(10, 20);
		expect(second).toMatchObject({ x: 210, y: 220 });
		test.store.projectEdits.apply({ deletes: [second] });
		// The detached target's preview is discarded immediately; collection settlement recomputes layout.
		expect(second).toMatchObject({ x: 200, y: 200 });
		test.move(10, 20);
		expect(second).toMatchObject({ x: 200, y: 200 });
		test.release();
		expect(test.visibleNames()).toEqual(['env', 'first']);
		expect(first.code).toContain('; @pos 6 6');
		expect(second.code).toContain('; @pos 20 10');
		expect(test.revision()).toEqual(before.map(value => value + 2));
	});

	it('cancels the entire drag when its primary block is deleted', () => {
		const test = setup(projectSource(firstSource, secondSource));
		const first = test.block('first');
		const second = test.block('second');
		const before = test.revision();
		test.selectTargets(first, second);
		test.press(first);
		test.move(10, 20);
		expect(first).toMatchObject({ x: 60, y: 120 });
		expect(second).toMatchObject({ x: 210, y: 220 });
		test.store.projectEdits.apply({ deletes: [first] });
		expect(first).toMatchObject({ x: 50, y: 100 });
		expect(second).toMatchObject({ x: 200, y: 200 });
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(test.move(10, 20).stopPropagation).toBe(false);
		test.release();
		expect(test.visibleNames()).toEqual(['env', 'second']);
		expect(second).toMatchObject({ x: 200, y: 200, gridX: 20, gridY: 10 });
		expect(second.code).toContain('; @pos 20 10');
		expect(test.revision()).toEqual(before.map(value => value + 1));
	});

	it('cancels the drag when navigation changes the visible level', () => {
		const test = setup(
			projectSource(
				firstSource,
				'group nested\n; @pos 45 5\nentry main',
				moduleSource('child', 8, 4),
				'entryEnd\ngroupEnd'
			)
		);
		const first = test.block('first');
		const owner = test.block('nested');
		const before = test.revision();
		test.press(first);
		test.move(10, 20);
		expect(first).toMatchObject({ x: 60, y: 120 });
		test.events.dispatch('openProjectGroup', { codeBlock: owner });
		expect(test.state.codeBlockRendering.currentProject).toBe(owner.childProject);
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(first).toMatchObject({ x: 50, y: 100 });
		expect(test.move(10, 20).stopPropagation).toBe(false);
		test.release();

		const child = test.block('child');
		test.press(child);
		test.move(10, 20);
		expect(child).toMatchObject({ x: 90, y: 100 });
		test.events.dispatch('goToParentProjectGroup');
		expect(test.state.codeBlockRendering.currentProject).toBe(test.state.codeBlockRendering.rootProject);
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(child).toMatchObject({ x: 80, y: 80 });
		expect(test.move(10, 20).stopPropagation).toBe(false);
		test.release();
		expect(first.code).toContain('; @pos 5 5');
		expect(child.code).toContain('; @pos 8 4');
		expect(test.revision()).toEqual(before);
	});

	it.each(['replace', 'undo'] as const)(
		'cancels the drag on %s even when the restored block has the same name',
		kind => {
			const test = setup();
			const first = test.block('first');
			const code = ['module first', '; @pos 8 8', 'moduleEnd'];
			test.store.projectEdits.apply({ updates: [{ codeBlock: first, code }] }, 'checkpoint');
			const before = test.revision();
			test.press(first);
			test.move(10, 20);
			expect(first).toMatchObject({ x: 90, y: 180 });
			if (kind === 'undo') test.events.dispatch('undo');
			else test.load(projectSource(firstSource));
			const restored = test.block('first');
			expect(restored).not.toBe(first);
			expect(first).toMatchObject({ x: 80, y: 160 });
			expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
			expect(test.move(10, 20).stopPropagation).toBe(false);
			test.release();
			expect(restored).toMatchObject({ x: 50, y: 100, gridX: 5, gridY: 5 });
			expect(restored.code).toContain('; @pos 5 5');
			expect(test.revision()).toEqual(before.map(value => value + 1));
		}
	);

	it('cancels and discards the drag preview when a replacement grid is pending', () => {
		const test = setup();
		const block = test.block('first');
		const before = test.revision();
		const { lastUpdated } = block;
		test.press(block);
		test.move(10, 20);
		expect(block).toMatchObject({ x: 60, y: 120 });
		markGridSizePending(test.state);
		test.release();
		expect(block).toMatchObject({ x: 50, y: 100, gridX: 5, gridY: 5, lastUpdated });
		expect(block.code).toContain('; @pos 5 5');
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(test.revision()).toEqual(before);
	});

	it('does not drag if moduleDragging is disabled', () => {
		const test = setup(projectSource(firstSource), { moduleDragging: false });
		test.press(test.block('first'));
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
	});

	it('selects without dragging when editing is disabled', () => {
		const test = setup(projectSource(firstSource, secondSource), { mode: 'view' });
		const first = test.block('first');
		test.press(first);
		test.move(10, 10);
		test.release();
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(first);
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(first).toMatchObject({ x: 50, y: 100 });
		expect(test.visibleNames()).toEqual(['env', 'second', 'first']);
	});

	it('selects the block without changing its source or position on click without drag', () => {
		const test = setup();
		const first = test.block('first');
		const { lastUpdated, code } = first;
		test.press(first);
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(first);
		test.release();
		expect(first).toMatchObject({ gridX: 5, gridY: 5, lastUpdated });
		expect(first.code).toBe(code);
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
	});

	it('clears selection when pointerdown is on empty space', () => {
		const test = setup();
		test.press(test.block('first'));
		test.release();
		test.events.dispatch('pointerdown', test.pointer(400, 400));
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
	});

	it('brings a normal block forward without crossing the always-on-top partition', () => {
		const test = setup(projectSource(firstSource, secondSource, moduleSource('top', 45, 5, '; @alwaysOnTop')));
		test.press(test.block('first'));
		expect(test.visibleNames()).toEqual(['env', 'second', 'first', 'top']);
	});

	it('brings an always-on-top block forward within its partition', () => {
		const test = setup(
			projectSource(
				firstSource,
				moduleSource('top1', 25, 5, '; @alwaysOnTop'),
				moduleSource('top2', 45, 5, '; @alwaysOnTop')
			)
		);
		test.press(test.block('top1'));
		expect(test.visibleNames()).toEqual(['env', 'first', 'top2', 'top1']);
	});
});
