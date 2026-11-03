import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState, { applyCodeBlockSourceEdits, serializeToProject } from '../../../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('enterEditMode');
	cleanups.push(store.dispose);
	events.dispatch('loadProject', {
		project: parseProjectSource('8f4e/v1\nentry main\nmodule audio\n; space\nmoduleEnd\nentryEnd'),
	});
	events.dispatch('enterEditMode');
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
	return { store, state, block, events, layout: store.layout };
}

describe('independent layout contributions', () => {
	it('keeps info updates independent of block layout and compiler inputs', () => {
		const { store, state, layout, events } = setup();
		const onLayout = vi.fn();
		const onCompilationInputChanged = vi.fn();
		const unsubscribe = layout.subscribe(onLayout);
		events.on('compilationInputChanged', onCompilationInputChanged);
		onLayout.mockClear();

		store.set('info.graphics', { fps: 60 });
		store.set('info.graphics', { fps: 30, timeToRenderMs: 12 });

		expect(state.info.graphics).toEqual({ fps: 30, timeToRenderMs: 12 });
		expect(onLayout).not.toHaveBeenCalled();
		expect(onCompilationInputChanged).not.toHaveBeenCalled();
		unsubscribe();
	});

	it('recalculates added, updated, removed, and disposed requests without source edits or compilation', () => {
		const { store, state, block, layout } = setup();
		store.set('codeBlockRendering.selectedCodeBlock', block);
		const source = serializeToProject(state);
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		const height = block.height;
		const width = block.width;
		const lastUpdated = block.lastUpdated;
		const first = layout.createContribution();
		const second = layout.createContribution();
		first.update(block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 3 }], minGridWidth: 40 });
		second.update(block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }], minGridWidth: 30 });
		expect(block.gaps.get(1)?.size).toBe(5);
		expect(block.width).toBe(40 * state.viewport.vGrid);
		expect(block.height).toBe(height + 5 * state.viewport.hGrid);
		first.update(block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 1 }] });
		expect(block.gaps.get(1)?.size).toBe(3);
		expect(block.width).toBe(30 * state.viewport.vGrid);
		first.remove(block);
		expect(block.gaps.get(1)?.size).toBe(2);
		second.dispose();
		first.dispose();
		expect(block.gaps.size).toBe(0);
		expect(block.height).toBe(height);
		expect(block.width).toBe(width);
		expect(serializeToProject(state)).toEqual(source);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
		expect(block.lastUpdated).toBe(lastUpdated);
		expect(state.projectChange.revision).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
	});

	it('lets subscribers recalculate requests from source changes and receive the resulting layout', () => {
		const { store, state, block, layout } = setup();
		const contribution = layout.createContribution();
		const calculated = vi.fn();
		const unsubscribe = layout.subscribe(({ codeBlock }) => {
			if (codeBlock !== block) return;
			const rows = codeBlock.code.includes('; space') ? 2 : 0;
			contribution.update(codeBlock, {
				verticalSpaceAfterSourceLine: rows ? [{ sourceLineIndex: 1, heightInRows: rows }] : [],
			});
			calculated(codeBlock.height, codeBlock.gaps.get(1)?.size ?? 0);
		});
		expect(calculated).toHaveBeenLastCalledWith(block.height, 2);
		const calls = calculated.mock.calls.length;
		contribution.update(block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		expect(calculated).toHaveBeenCalledTimes(calls);
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: ['module audio', 'moduleEnd'] }], {
			affectsCompilation: true,
		});
		expect(block.gaps.size).toBe(0);
		expect(calculated).toHaveBeenLastCalledWith(block.height, 0);
		const revision = state.projectChange.revision;
		unsubscribe();
		contribution.dispose();
		expect(state.projectChange.revision).toBe(revision);
	});

	it('updates geometry after font changes and keeps editors independent', () => {
		const first = setup();
		const second = setup();
		const contribution = first.layout.createContribution();
		contribution.update(first.block, { verticalSpaceAfterSourceLine: [{ sourceLineIndex: 1, heightInRows: 2 }] });
		expect(second.block.gaps.size).toBe(0);
		const onLayout = vi.fn();
		const unsubscribe = first.layout.subscribe(onLayout);
		first.state.viewport.hGrid = 24;
		first.events.dispatch('spriteSheetRerendered');
		expect(first.block.height).toBe(5 * 24);
		expect(onLayout).toHaveBeenCalledWith({ codeBlock: first.block, state: first.state });
		unsubscribe();
		contribution.dispose();
	});
});
