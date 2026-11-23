import { EventEmitter } from 'node:events';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-loading/emptyDefaultProject';
import serializeProjectLevel from '~/pureHelpers/projectSerialization/serializeProjectLevel';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';
import initState, { setGridSize } from '../../index';
import { deleteCodeBlocks } from './deleteCodeBlocks';
import { insertCodeBlocks } from './insertCodeBlocks';

describe('creationIndex', () => {
	let mockState: State;
	let store: ReturnType<typeof initState>;
	let emitter: EventEmitter;

	beforeEach(() => {
		emitter = new EventEmitter();
		const events = {
			on: emitter.on.bind(emitter),
			off: emitter.off.bind(emitter),
			dispatch: emitter.emit.bind(emitter),
		};
		store = initState(events, { callbacks: {} });
		mockState = store.getState();
		setGridSize(mockState, events, TEST_GRID_SIZE);
		events.dispatch('enterEditMode');
	});
	afterEach(() => store.dispose());

	describe('source insertion', () => {
		it('assigns increasing identities and does not reuse deleted identities', () => {
			const insert = (name: string) =>
				insertCodeBlocks(store, {
					x: 0,
					y: 0,
					blocks: [{ code: [`module ${name}`, 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } }],
				});
			insert('first');
			insert('second');
			insert('third');
			expect(mockState.codeBlockRendering.currentProject.blocks.map(block => block.creationIndex)).toEqual([0, 1, 2]);
			deleteCodeBlocks(store, [mockState.codeBlockRendering.currentProject.blocks[1]]);
			insert('fourth');
			expect(mockState.codeBlockRendering.currentProject.blocks.map(block => block.creationIndex)).toEqual([0, 2, 3]);
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(4);
		});
	});

	describe('projectLoading', () => {
		it('should assign creationIndex to code blocks when loading a project', () => {
			const projectWithBlocks: ProjectObjectModel = {
				...EMPTY_DEFAULT_PROJECT,
				execution: [
					{ type: 'module', id: 0, code: ['module a', 'moduleEnd'], entry: 'main' },
					{ type: 'module', id: 1, code: ['module b', 'moduleEnd'], entry: 'main' },
					{ type: 'module', id: 2, code: ['module c', 'moduleEnd'], entry: 'main' },
				],
			};

			emitter.emit('loadProject', { project: projectWithBlocks });

			const codeBlocks = mockState.codeBlockRendering.currentProject.blocks;
			expect(codeBlocks).toHaveLength(4);

			// Authored identities survive loading, and the generated environment receives a new one.
			expect(codeBlocks.map(block => [block.name, block.creationIndex])).toEqual([
				['env', 3],
				['a', 0],
				['b', 1],
				['c', 2],
			]);
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(4);
		});

		it('should reset creationIndex counter when loading a new project', () => {
			// Set a high nextCodeBlockCreationIndex
			mockState.codeBlockRendering.nextCodeBlockCreationIndex = 100;

			const project: ProjectObjectModel = {
				...EMPTY_DEFAULT_PROJECT,
				execution: [{ type: 'module', id: 0, code: ['module a', 'moduleEnd'], entry: 'main' }],
			};

			emitter.emit('loadProject', { project });

			// Counter should account for the authored module and generated environment.
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(2);
		});
	});

	describe('compiler ordering', () => {
		it('should sort module code blocks by grid position for compilation', async () => {
			const block1 = createMockCodeBlock({
				name: 'a',
				creationIndex: 0,
				code: ['module a', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				gridX: 20,
				gridY: 0,
			});
			const block2 = createMockCodeBlock({
				name: 'b',
				creationIndex: 1,
				code: ['module b', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				gridX: 0,
				gridY: 10,
			});
			const block3 = createMockCodeBlock({
				name: 'c',
				creationIndex: 2,
				code: ['module c', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				gridX: 0,
				gridY: 0,
			});

			const codeBlocksArray = [block1, block2, block3];

			const { execution: modules } = serializeProjectLevel({ path: '', entries: [], blocks: codeBlocksArray });

			expect(modules[0].code).toEqual(['module c', 'moduleEnd']); // left, top
			expect(modules[1].code).toEqual(['module b', 'moduleEnd']); // left, lower
			expect(modules[2].code).toEqual(['module a', 'moduleEnd']); // right
		});

		it('should use creationIndex as the tie-breaker when module grid positions match', async () => {
			const block1 = createMockCodeBlock({
				name: 'a',
				creationIndex: 2,
				code: ['module a', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				gridX: 0,
				gridY: 0,
			});
			const block2 = createMockCodeBlock({
				name: 'b',
				creationIndex: 0,
				code: ['module b', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				gridX: 0,
				gridY: 0,
			});
			const block3 = createMockCodeBlock({
				name: 'c',
				creationIndex: 1,
				code: ['module c', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				gridX: 0,
				gridY: 0,
			});

			const { execution: modules } = serializeProjectLevel({ path: '', entries: [], blocks: [block1, block2, block3] });

			expect(modules[0].code).toEqual(['module b', 'moduleEnd']);
			expect(modules[1].code).toEqual(['module c', 'moduleEnd']);
			expect(modules[2].code).toEqual(['module a', 'moduleEnd']);
		});

		it('should use grid position even when a referenced module is visually later', async () => {
			const dependentBlock = createMockCodeBlock({
				name: 'dependent',
				creationIndex: 0,
				code: ['module dependent', 'int* ptr &source:0', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				gridX: 0,
				gridY: 0,
			});
			const sourceBlock = createMockCodeBlock({
				name: 'source',
				creationIndex: 1,
				code: ['module source', 'int value 0', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				gridX: 20,
				gridY: 0,
			});

			const { execution: modules } = serializeProjectLevel({
				path: '',
				entries: [],
				blocks: [dependentBlock, sourceBlock],
			});

			expect(modules[0].code).toEqual(['module dependent', 'int* ptr &source:0', 'moduleEnd']);
			expect(modules[1].code).toEqual(['module source', 'int value 0', 'moduleEnd']);
		});

		it('should separate modules and functions for compilation', async () => {
			const moduleBlock = createMockCodeBlock({
				name: 'testModule',
				creationIndex: 0,
				code: ['module testModule', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
			});
			const functionBlock = createMockCodeBlock({
				name: 'testFunc',
				creationIndex: 1,
				code: ['function testFunc', 'functionEnd'],
				blockType: 'function',
			});
			const secondModuleBlock = createMockCodeBlock({
				name: 'testModuleTwo',
				creationIndex: 2,
				code: ['module testModuleTwo', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
			});

			const codeBlocksArray = [moduleBlock, functionBlock, secondModuleBlock];

			const { execution: modules, functions } = serializeProjectLevel({
				path: '',
				entries: [],
				blocks: codeBlocksArray,
			});

			expect(modules.length).toBe(2);
			expect(modules[0].code).toEqual(['module testModule', 'moduleEnd']);
			expect(modules[1].code).toEqual(['module testModuleTwo', 'moduleEnd']);
			expect(functions.length).toBe(1);
			expect(functions[0].code).toEqual(['function testFunc', 'functionEnd']);
		});
	});
});
