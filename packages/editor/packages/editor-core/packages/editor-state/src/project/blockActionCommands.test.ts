import { EventEmitter } from 'node:events';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { ProjectSourceBlock } from '@8f4e/editor-state-types';
import { afterEach, describe, expect, it } from 'vitest';
import initState, { setGridSize } from '../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(sources: readonly ProjectSourceBlock[] = []) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	cleanups.push(store.dispose);
	const state = store.getState();
	setGridSize(state, events, TEST_GRID_SIZE);
	events.dispatch('enterEditMode');
	const { insertedBlocks } = store.projectTransactions.apply({
		inserts: sources.map(source => ({ targetLevel: state.project.activeLevel, source })),
	});
	const insert = (code: string[]) => events.dispatch('insertCodeBlock', { x: 100, y: 100, code });
	return { state, events, store, blocks: insertedBlocks, insert };
}

describe('codeBlockActions - insertion', () => {
	it.each(['module', 'function'])('inserts duplicate %s names without rewriting source references', blockType => {
		const { state, insert } = setup([{ code: [`${blockType} same`, `${blockType}End`] }]);
		insert([`${blockType} same`, 'push &same:value', `${blockType}End`]);
		const block = state.project.activeLevel.blocks.at(-1)!;
		expect(block.name).toBe('same');
		expect(block.code[0]).toBe(`${blockType} same`);
		expect(block.code).toContain('push &same:value');
	});

	it('ignores insertion in view mode', () => {
		const { state, events, insert } = setup();
		events.dispatch('exitToViewMode');
		insert(['module supplied', 'moduleEnd']);
		expect(state.project.activeLevel.blocks).toHaveLength(0);
	});

	it('creates a new empty module assigned to a fresh execution entry outside existing entries', () => {
		const { state, insert } = setup();
		insert(['module supplied', 'moduleEnd']);
		const blocks = state.project.activeLevel.blocks;
		expect(blocks).toHaveLength(1);
		expect(blocks[0].entry).toBe('entry');
		expect(blocks[0].code[0]).toBe('module supplied');
		expect(blocks[0].code[1]).toMatch(/^; @pos \d+ \d+$/);
		expect(blocks[0].code.at(-1)).toBe('moduleEnd');
	});

	it.each([
		{ usedEntries: ['entry'], expected: 'entry2' },
		{ usedEntries: ['entry', 'entry2', 'entry4'], expected: 'entry3' },
		{ usedEntries: ['entry', ...Array.from({ length: 18 }, (_, index) => `entry${index + 2}`)], expected: 'entry20' },
	])('chooses $expected as the first available fresh entry', ({ usedEntries, expected }) => {
		const { state, insert } = setup(
			usedEntries.map((entry, index) => ({
				code: [`module existing${index}`, 'moduleEnd'],
				entry,
			}))
		);
		insert(['module supplied', 'moduleEnd']);
		expect(state.project.activeLevel.blocks.at(-1)!.entry).toBe(expected);
	});
});

describe('codeBlockActions - alwaysOnTop z-order partitioning', () => {
	it.each([false, true])('inserts a block in the correct z-order partition (alwaysOnTop=%s)', alwaysOnTop => {
		const { state, insert } = setup([
			{ code: ['module normal1', 'moduleEnd'] },
			{ code: ['module top1', '; @alwaysOnTop', 'moduleEnd'] },
		]);
		insert(['module new', ...(alwaysOnTop ? ['; @alwaysOnTop'] : []), 'moduleEnd']);
		const blocks = state.project.activeLevel.blocks;
		expect(blocks.map(block => block.name)).toEqual(
			alwaysOnTop ? ['normal1', 'top1', 'new'] : ['normal1', 'new', 'top1']
		);
		expect(blocks.find(block => block.name === 'new')!.alwaysOnTop).toBe(alwaysOnTop);
	});
});
