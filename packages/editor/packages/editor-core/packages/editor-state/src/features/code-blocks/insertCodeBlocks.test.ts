import createStateManager from '@8f4e/state-manager';
import { describe, expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { insertCodeBlocks } from './insertCodeBlocks';

describe('insertCodeBlocks', () => {
	it('preserves declaration names and references while positioning a batch with distinct identities', () => {
		const state = createMockState();
		state.codeBlockRendering.currentProject.blocks.push(
			createMockCodeBlock({ name: 'same', code: ['module same', 'moduleEnd'] })
		);
		state.codeBlockRendering.nextCodeBlockCreationIndex = 5;
		insertCodeBlocks(createStateManager(state), {
			x: 80,
			y: 64,
			blocks: [
				{ code: ['module same', 'push &same:value', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 }, entry: 'audio' },
				{ code: ['module same', 'push &same:value', 'moduleEnd'], gridCoordinates: { x: 4, y: -1 }, entry: 'audio' },
			],
		});
		const blocks = state.codeBlockRendering.currentProject.blocks.slice(1);
		expect(blocks.map(block => block.name)).toEqual(['same', 'same']);
		expect(blocks.map(block => block.creationIndex)).toEqual([5, 6]);
		expect(blocks.map(block => [block.gridX, block.gridY])).toEqual([
			[10, 4],
			[14, 3],
		]);
		for (const block of blocks) expect(block.code).toContain('push &same:value');
	});
	it('preserves nested entry tables and source names without renaming project groups', () => {
		const state = createMockState();
		state.codeBlockRendering.currentProject.blocks.push(
			createMockCodeBlock({
				name: 'layer',
				code: ['group layer', 'groupEnd'],
				childProject: { path: 'layer', entries: [], blocks: [] },
			})
		);
		insertCodeBlocks(createStateManager(state), {
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
		const owner = state.codeBlockRendering.currentProject.blocks[1];
		expect(owner.name).toBe('layer');
		expect(owner.childProject?.path).toBe('layer');
		expect(owner.childProject?.entries).toEqual(['empty', 'audio']);
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
	});
});
