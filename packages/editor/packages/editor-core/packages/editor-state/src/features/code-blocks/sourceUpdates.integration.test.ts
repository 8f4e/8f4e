import { EventEmitter } from 'node:events';
import type { CodeBlockGraphicData, CodeBlockLayoutsChangedEvent } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { expect, it, vi } from 'vitest';
import initState, { markGridSizePending, setGridSize } from '~/index';

it('settles source and configuration immediately, but publishes pixel layout only once the grid is available', () => {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, {
		callbacks: {},
		editorConfigSchemaContributions: { test: { root: 'test', schema: { type: 'string' } } },
	});
	const state = store.getState();
	const onLayout = vi.fn();
	const unsubscribeLayout = store.layout.subscribe(onLayout);
	const notifications: string[] = [];
	events.on('codeBlockLayoutsChanged', () => notifications.push('layout'));
	events.on('gridSizeChanged', () => {
		// Core handles this notification before consumers and settles the affected geometry.
		expect(state.gridSizeReady).toBe(false);
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sample')!;
		expect(block.x).toBe(4 * state.viewport.vGrid);
		expect(block.y).toBe(5 * state.viewport.hGrid);
		notifications.push('grid-changed');
	});
	events.on('gridSizeReady', () => {
		expect(state.gridSizeReady).toBe(true);
		notifications.push('grid-ready');
	});
	try {
		events.dispatch('loadProject', {
			project: parseProjectSource(`8f4e/v1
entry main
module sample
; @pos 4 5
; @config test enabled
moduleEnd
entryEnd`),
		});
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sample')!;
		expect(state.viewport).toMatchObject({ vGrid: 0, hGrid: 0 });
		expect(state.gridSizeReady).toBe(false);
		expect(state.editorConfig.test).toBe('enabled');
		expect(state.compilerInputRevision).toBeGreaterThan(0);
		expect(block).toMatchObject({ gridX: 4, gridY: 5, x: 0, y: 0, width: 0, height: 0 });
		expect(state.codeBlockRendering.entryBounds).toEqual([]);
		expect(onLayout).not.toHaveBeenCalled();
		expect(notifications).toEqual([]);

		setGridSize(state, events, { vGrid: 6, hGrid: 12 });
		expect(block).toMatchObject({ x: 24, y: 60, height: 48 });
		expect(block.width).toBeGreaterThan(0);
		expect(state.codeBlockRendering.entryBounds).toHaveLength(1);
		expect(onLayout).toHaveBeenCalled();
		expect(notifications).toEqual(['layout', 'grid-changed', 'grid-ready']);

		notifications.length = 0;
		markGridSizePending(state);
		expect(state.gridSizeReady).toBe(false);
		expect(state.viewport).toMatchObject({ vGrid: 6, hGrid: 12 });
		setGridSize(state, events, { vGrid: 6, hGrid: 12 });
		expect(notifications).toEqual(['grid-ready']);

		notifications.length = 0;
		setGridSize(state, events, { vGrid: 6, hGrid: 12 });
		expect(notifications).toEqual([]);

		setGridSize(state, events, { vGrid: 7, hGrid: 14 });
		expect(block).toMatchObject({ x: 28, y: 70, height: 56 });
		expect(notifications).toEqual(['layout', 'grid-changed', 'grid-ready']);
	} finally {
		unsubscribeLayout();
		store.dispose();
	}
});

it('continues laying out source while a replacement grid is pending', () => {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, initialGridSize: { vGrid: 6, hGrid: 12 } });
	const state = store.getState();
	const onLayout = vi.fn();
	const unsubscribeLayout = store.layout.subscribe(onLayout);
	try {
		markGridSizePending(state);
		events.dispatch('loadProject', {
			project: parseProjectSource('8f4e/v1\nnote sample\n; @pos 4 5\nnoteEnd'),
		});
		const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sample')!;
		expect(state.gridSizeReady).toBe(false);
		expect(block).toMatchObject({ x: 24, y: 60, height: 36 });
		expect(block.width).toBeGreaterThan(0);
		expect(onLayout).toHaveBeenCalledWith(expect.objectContaining({ codeBlock: block, state }));

		setGridSize(state, events, { vGrid: 8, hGrid: 16 });
		expect(block).toMatchObject({ x: 32, y: 80, height: 48 });
		expect(state.gridSizeReady).toBe(true);
	} finally {
		unsubscribeLayout();
		store.dispose();
	}
});

it('announces completed layouts after nested source and contribution updates during project loading', () => {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, initialGridSize: { vGrid: 8, hGrid: 16 } });
	const state = store.getState();
	const contribution = store.layout.createContribution();
	const completedLayouts: boolean[] = [];
	store.subscribe('codeErrors', () => {
		for (const block of state.codeBlockRendering.currentProject.blocks) {
			if (block.name === 'imported') {
				contribution.update(block, {
					verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }],
				});
			}
		}
	});
	events.on('codeBlockLayoutsChanged', ({ codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		completedLayouts.push(
			codeBlocks.every(block =>
				block.displayModel.lines.every(line => line.isPlaceholder || line.text === block.code[line.sourceLineIndex])
			)
		);
	});
	try {
		events.dispatch('loadProject', {
			project: parseProjectSource(`8f4e/v1
constants env
${Array.from({ length: 20 }, (_, index) => `const SAVED_${index} ${index}`).join('\n')}
constantsEnd
note imported
; @config audioRuntime.enabled true
Imported project
noteEnd`),
		});
		expect(completedLayouts.length).toBeGreaterThan(0);
		expect(completedLayouts).not.toContain(false);
		const env = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'env')!;
		expect(env.code).not.toContain('const SAVED_0 0');
		expect(state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'imported')!.gaps.size).toBe(1);
	} finally {
		contribution.dispose();
		store.dispose();
	}
});

it('notifies only affected blocks after dependent layout contributions settle', () => {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, initialGridSize: { vGrid: 8, hGrid: 16 } });
	events.dispatch('loadProject', {
		project: parseProjectSource(`8f4e/v1
note first
First block
noteEnd
note second
Second block
noteEnd`),
	});
	const state = store.getState();
	const first = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'first')!;
	const second = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'second')!;
	const contribution = store.layout.createContribution();
	const dependent = store.layout.createContribution();
	const notifications: Array<readonly CodeBlockGraphicData[]> = [];
	let updateDependent = false;
	const unsubscribe = store.layout.subscribe(({ codeBlock }) => {
		if (updateDependent && codeBlock === first) {
			dependent.update(second, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 3 }] });
		}
	});
	events.on('codeBlockLayoutsChanged', ({ codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		notifications.push([...codeBlocks]);
	});
	try {
		contribution.update(first, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 1 }] });
		expect(notifications).toEqual([[first]]);
		notifications.length = 0;
		updateDependent = true;
		contribution.update(first, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		expect(notifications).toEqual([[first, second]]);
		expect(first.height).toBe(5 * state.viewport.hGrid);
		expect(second.height).toBe(6 * state.viewport.hGrid);
	} finally {
		unsubscribe();
		dependent.dispose();
		contribution.dispose();
		store.dispose();
	}
});
