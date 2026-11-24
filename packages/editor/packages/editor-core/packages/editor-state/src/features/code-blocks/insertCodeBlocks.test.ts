import { EventEmitter } from 'node:events';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import { parseProjectSource } from '@8f4e/project-preparser';
import { afterEach, describe, expect, it } from 'vitest';
import initState, { setGridSize } from '../../index';
import { insertCodeBlocks } from './insertCodeBlocks';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(source: string, withGrid = true) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	cleanups.push(store.dispose);
	const state = store.getState();
	if (withGrid) setGridSize(state, events, TEST_GRID_SIZE);
	events.dispatch('loadProject', { project: parseProjectSource(`8f4e/v1\nentry main\n${source}\nentryEnd`) });
	events.dispatch('enterEditMode');
	return { store, state };
}

describe('insertCodeBlocks', () => {
	it('preserves declaration names and references while positioning a batch with distinct identities', () => {
		const { store, state } = setup('module same\nmoduleEnd');
		const existing = [...state.codeBlockRendering.currentProject.blocks];
		const nextId = state.codeBlockRendering.nextCodeBlockCreationIndex;
		const inserted = insertCodeBlocks(store, {
			x: 80,
			y: 64,
			blocks: [
				{ code: ['module same', 'push &same:value', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 }, entry: 'audio' },
				{ code: ['module same', 'push &same:value', 'moduleEnd'], gridCoordinates: { x: 4, y: -1 }, entry: 'audio' },
			],
		});
		const blocks = state.codeBlockRendering.currentProject.blocks.filter(block => !existing.includes(block));
		expect(inserted[0]).toBe(blocks[0]);
		expect(inserted[1]).toBe(blocks[1]);
		expect(blocks.map(block => block.name)).toEqual(['same', 'same']);
		expect(blocks.map(block => block.creationIndex)).toEqual([nextId, nextId + 1]);
		expect(blocks.map(block => [block.gridX, block.gridY])).toEqual([
			[10, 4],
			[14, 3],
		]);
		for (const block of blocks) expect(block.code).toContain('push &same:value');
	});
	it('preserves nested source data and updates descendant ownership when adding and removing a group', () => {
		const { store } = setup('group layer\ngroupEnd');
		const [owner] = insertCodeBlocks(store, {
			x: 0,
			y: 0,
			blocks: [
				{
					code: ['group layer', 'groupEnd'],
					gridCoordinates: { x: 0, y: 0 },
					childProject: {
						entries: ['empty', 'audio'],
						blocks: [
							{ code: ['module same', 'moduleEnd'], entry: 'audio', gridCoordinates: { x: 2, y: 3 } },
							{
								code: ['group inner', 'groupEnd'],
								gridCoordinates: { x: 4, y: 5 },
								childProject: { entries: ['silent'], blocks: [] },
							},
						],
					},
				},
			],
		});
		expect(owner.name).toBe('layer');
		expect(owner.childProject?.path).toBe('layer');
		expect(owner.childProject?.entries).toEqual(['empty', 'audio', 'main']);
		expect(owner.childProject?.blocks[0]).toMatchObject({
			name: 'same',
			entry: 'audio',
			projectPath: 'layer',
			gridX: 2,
			gridY: 3,
		});
		expect(owner.childProject?.blocks[1].childProject).toMatchObject({
			path: 'layer/inner',
			entries: ['silent'],
			blocks: [],
		});
		const nested = owner.childProject!.blocks[1].childProject!;
		const descendant = owner.childProject!.blocks[0];
		const { changed, insertedBlocks } = store.projectEdits.apply({
			updates: [{ codeBlock: descendant, code: ['module changed', 'moduleEnd'] }],
			inserts: [{ project: nested, source: { code: ['note added', 'noteEnd'] } }],
		});
		expect(changed).toBe(true);
		expect(descendant.name).toBe('changed');
		expect(nested.blocks).toEqual(insertedBlocks);
		store.projectEdits.apply({ deletes: [owner] });
		expect(() =>
			store.projectEdits.apply({ inserts: [{ project: nested, source: { code: ['note detached', 'noteEnd'] } }] })
		).toThrow(expect.objectContaining({ code: 'detached_project' }));
		expect(() =>
			store.projectEdits.apply({ updates: [{ codeBlock: insertedBlocks[0], code: ['note detached', 'noteEnd'] }] })
		).toThrow(expect.objectContaining({ code: 'detached_block' }));
	});
	it('does not convert pixel coordinates before a grid is installed', () => {
		const { store, state } = setup('module same\nmoduleEnd', false);
		const before = state.projectChange.revision;
		expect(
			insertCodeBlocks(store, {
				x: 10,
				y: 10,
				blocks: [{ code: ['module new', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } }],
			})
		).toEqual([]);
		expect(state.projectChange.revision).toBe(before);
	});
});
