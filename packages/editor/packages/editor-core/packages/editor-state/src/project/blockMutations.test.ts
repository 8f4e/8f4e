import { EventEmitter } from 'node:events';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData, EditorLifecycleEvents } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState, { setGridSize } from '../index';
import { deleteCodeBlocks } from './deleteCodeBlocks';
import { applyCodeBlockSourceEdits } from './replaceBlockSources';

const cleanups: Array<() => void> = [];
function setup(nested = false) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	setGridSize(state, events, TEST_GRID_SIZE);
	const modules = ['first', 'second', 'untouched'].flatMap((name, index) => [
		`module ${name}`,
		`; @pos ${10 + index * 40} 10`,
		'moduleEnd',
	]);
	const project = parseProjectSource(
		[
			'8f4e/v1',
			'entry main',
			...(nested ? ['group owner', 'entry main'] : []),
			...modules,
			...(nested ? ['entryEnd', 'groupEnd'] : []),
			'entryEnd',
		].join('\n')
	);
	events.dispatch('loadProject', { project });
	if (nested)
		events.dispatch('openProjectGroup', {
			codeBlock: state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'owner')!,
		});
	events.dispatch('enterEditMode');
	const blocks = state.codeBlockRendering.currentProject.blocks;
	const [first, second, untouched] = ['first', 'second', 'untouched'].map(
		name => blocks.find(block => block.name === name)!
	);
	for (const block of [first, second, untouched]) block.lastUpdated = 1;
	const press = (block: CodeBlockGraphicData) =>
		events.dispatch('pointerdown', {
			x: block.x - state.viewport.x + 1,
			y: block.y - state.viewport.y + 1,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			altKey: false,
			canvasWidth: 800,
			canvasHeight: 600,
			stopPropagation: false,
		});
	cleanups.push(store.dispose);
	return { store, events, state, first, second, untouched, press };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('block source edits', () => {
	it('refreshes changed blocks before publishing the whole batch', () => {
		const { store, events, state, first, second, untouched } = setup();
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		state.codeBlockRendering.selectedCodeBlock = untouched;
		const firstCode = ['module first', 'int value 1', 'moduleEnd'];
		const secondCode = ['module second', 'int value 2', 'moduleEnd'];
		const untouchedCode = untouched.code;
		const refreshed: unknown[] = [];
		const onCompilerChange = vi.fn(() => {
			expect(first.code).toEqual(firstCode);
			expect(second.code).toEqual(secondCode);
		});
		const onProjectChange = vi.fn(() => {
			expect(refreshed).toEqual([first, second]);
			expect(state.compilerInputRevision).toBe(compilerRevision + 1);
		});
		const onLayoutsChanged = vi.fn(({ codeBlocks }: EditorLifecycleEvents['codeBlockLayoutsChanged']) => {
			refreshed.push(...codeBlocks);
			expect(first.code).toEqual(firstCode);
			expect(second.code).toEqual(secondCode);
		});
		events.on('codeBlockLayoutsChanged', onLayoutsChanged);
		store.subscribe('compilerInputRevision', onCompilerChange);
		store.subscribe('projectChange', onProjectChange);
		expect(
			applyCodeBlockSourceEdits(store, [
				{ codeBlock: first, code: firstCode },
				{ codeBlock: untouched, code: [...untouchedCode] },
				{ codeBlock: second, code: secondCode },
			])
		).toBe(true);
		expect(first.lastUpdated).toBeGreaterThan(1);
		expect(second.lastUpdated).toBeGreaterThan(1);
		expect(untouched.lastUpdated).toBe(1);
		expect(untouched.code).toBe(untouchedCode);
		expect(onLayoutsChanged).toHaveBeenCalledExactlyOnceWith({
			project: state.codeBlockRendering.currentProject,
			codeBlocks: [first, second],
		});
		expect(onCompilerChange).toHaveBeenCalledTimes(1);
		expect(onProjectChange).toHaveBeenCalledTimes(1);
		expect(state.projectChange.revision).toBe(revision + 1);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(untouched);
	});

	it('does not refresh or publish empty and unchanged batches', () => {
		const { store, events, state, first } = setup();
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		const onRefresh = vi.fn();
		events.on('codeBlockLayoutsChanged', onRefresh);
		expect(applyCodeBlockSourceEdits(store, [])).toBe(false);
		expect(applyCodeBlockSourceEdits(store, [{ codeBlock: first, code: [...first.code] }])).toBe(false);
		expect(first.lastUpdated).toBe(1);
		expect(onRefresh).not.toHaveBeenCalled();
		expect(state.projectChange.revision).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
	});
});

describe('block deletion', () => {
	it('removes a batch from the visible nested slice in place and clears deleted references before publishing', () => {
		const { store, state, first, second, untouched, press } = setup(true);
		const nested = state.codeBlockRendering.currentProject.blocks;
		const root = state.codeBlockRendering.rootProject.blocks;
		const owner = root.find(block => block.name === 'owner')!;
		const compilerRevision = state.compilerInputRevision;
		press(second);
		store.set('codeBlockRendering.selectedCodeBlock', first);
		expect(state.codeBlockRendering.draggedCodeBlock).toBe(second);
		const onProjectChange = vi.fn(() => {
			expect(nested).toEqual([untouched]);
			expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
			expect(state.compilerInputRevision).toBe(compilerRevision + 1);
		});
		store.subscribe('projectChange', onProjectChange);
		expect(deleteCodeBlocks(store, [first, second])).toBe(true);
		expect(owner.childProject?.blocks).toBe(nested);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(nested);
		expect(state.codeBlockRendering.rootProject.blocks).toBe(root);
		expect(root).toContain(owner);
		expect(onProjectChange).toHaveBeenCalledTimes(1);
	});

	it('keeps selection on surviving blocks, cancels dragging, and ignores repeated deletion', () => {
		const { store, state, first, second, press } = setup();
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		press(second);
		expect(state.codeBlockRendering.draggedCodeBlock).toBe(second);
		expect(deleteCodeBlocks(store, [first])).toBe(true);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(second);
		expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(deleteCodeBlocks(store, [first])).toBe(false);
		expect(deleteCodeBlocks(store, [])).toBe(false);
		expect(state.projectChange.revision).toBe(revision + 1);
		expect(state.compilerInputRevision).toBe(compilerRevision + 1);
	});
});
