import type { State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance } from 'vitest';
import projectLoading from '~/features/project-loading/effect';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-loading/emptyDefaultProject';
import convertGraphicDataToProjectStructure from '~/pureHelpers/projectSerialization/serializeCodeBlocks';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import codeBlockRendering from './effect';
import codeBlockCreator from './features/codeBlockCreator/effect';
import { directiveDefinitions } from './features/directives/registry';
import { createLayoutRegistry } from './layout/registry';

describe('creationIndex', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	describe('codeBlockCreator', () => {
		it('should assign creationIndex to new code blocks', () => {
			// Initialize the codeBlockCreator
			codeBlockCreator(store, mockEvents);

			// Find the createCodeBlock handler
			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const createCodeBlockCall = onCalls.find(call => call[0] === 'createCodeBlock');
			expect(createCodeBlockCall).toBeDefined();

			const createCodeBlockHandler = createCodeBlockCall![1];

			// Initial state should have nextCodeBlockCreationIndex = 0
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(0);

			// Add first code block
			createCodeBlockHandler({ x: 0, y: 0, blockType: 'module' });

			// Verify first code block got creationIndex 0
			const codeBlocks = mockState.codeBlockRendering.codeBlocks;
			expect(codeBlocks.length).toBe(1);
			expect(codeBlocks[0].creationIndex).toBe(0);
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(1);
		});

		it('should increment creationIndex for each new code block', () => {
			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const createCodeBlockCall = onCalls.find(call => call[0] === 'createCodeBlock');
			const createCodeBlockHandler = createCodeBlockCall![1];

			// Add multiple code blocks
			createCodeBlockHandler({ x: 0, y: 0, blockType: 'module' });
			createCodeBlockHandler({ x: 100, y: 0, blockType: 'module' });
			createCodeBlockHandler({ x: 200, y: 0, blockType: 'module' });

			const codeBlocks = mockState.codeBlockRendering.codeBlocks;
			expect(codeBlocks.length).toBe(3);

			// Verify each block has a unique, incrementing creationIndex
			const creationIndexes = codeBlocks.map(b => b.creationIndex).sort((a, b) => a - b);
			expect(creationIndexes).toEqual([0, 1, 2]);
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(3);
		});

		it('should leave gaps in creationIndex when blocks are deleted', () => {
			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const createCodeBlockCall = onCalls.find(call => call[0] === 'createCodeBlock');
			const deleteCodeBlockCall = onCalls.find(call => call[0] === 'deleteCodeBlock');
			const createCodeBlockHandler = createCodeBlockCall![1];
			const deleteCodeBlockHandler = deleteCodeBlockCall![1];

			// Add three code blocks
			createCodeBlockHandler({ x: 0, y: 0, blockType: 'module' });
			createCodeBlockHandler({ x: 100, y: 0, blockType: 'module' });
			createCodeBlockHandler({ x: 200, y: 0, blockType: 'module' });

			// Delete the middle one (creationIndex 1)
			const codeBlocks = mockState.codeBlockRendering.codeBlocks;
			const middleBlock = codeBlocks.find(b => b.creationIndex === 1);
			deleteCodeBlockHandler({ codeBlock: middleBlock });

			// Add a new block
			createCodeBlockHandler({ x: 300, y: 0, blockType: 'module' });

			// Verify the new block gets creationIndex 3 (not 1, leaving a gap)
			const updatedCodeBlocks = mockState.codeBlockRendering.codeBlocks;
			const creationIndexes = updatedCodeBlocks.map(b => b.creationIndex).sort((a, b) => a - b);
			expect(creationIndexes).toEqual([0, 2, 3]);
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(4);
		});
	});

	describe('projectLoading', () => {
		it('should assign creationIndex to code blocks when loading a project', () => {
			projectLoading(store, mockEvents);
			codeBlockRendering(
				store,
				mockEvents,
				directiveDefinitions,
				createLayoutRegistry(() => {})
			);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const loadProjectCall = onCalls.find(call => call[0] === 'loadProject');
			const loadProjectCallback = loadProjectCall![1];

			const projectWithBlocks: ProjectObjectModel = {
				...EMPTY_DEFAULT_PROJECT,
				modules: [
					{ id: 0, code: ['module a', 'moduleEnd'], entry: 'main' },
					{ id: 1, code: ['module b', 'moduleEnd'], entry: 'main' },
					{ id: 2, code: ['module c', 'moduleEnd'], entry: 'main' },
				],
			};

			loadProjectCallback({ project: projectWithBlocks });

			const codeBlocks = mockState.codeBlockRendering.codeBlocks;
			expect(codeBlocks.length).toBe(3);

			// Verify each block has a creationIndex
			const creationIndexes = codeBlocks.map(b => b.creationIndex).sort((a, b) => a - b);
			expect(creationIndexes).toEqual([0, 1, 2]);
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(3);
		});

		it('should reset creationIndex counter when loading a new project', () => {
			projectLoading(store, mockEvents);
			codeBlockRendering(
				store,
				mockEvents,
				directiveDefinitions,
				createLayoutRegistry(() => {})
			);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const loadProjectCall = onCalls.find(call => call[0] === 'loadProject');
			const loadProjectCallback = loadProjectCall![1];

			// Set a high nextCodeBlockCreationIndex
			mockState.codeBlockRendering.nextCodeBlockCreationIndex = 100;

			const project: ProjectObjectModel = {
				...EMPTY_DEFAULT_PROJECT,
				modules: [{ id: 0, code: ['module a', 'moduleEnd'], entry: 'main' }],
			};

			loadProjectCallback({ project });

			// Counter should be reset to the number of loaded blocks
			expect(mockState.codeBlockRendering.nextCodeBlockCreationIndex).toBe(1);
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

			const { modules } = convertGraphicDataToProjectStructure(codeBlocksArray);

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

			const { modules } = convertGraphicDataToProjectStructure([block1, block2, block3]);

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

			const { modules } = convertGraphicDataToProjectStructure([dependentBlock, sourceBlock]);

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

			const { modules, functions } = convertGraphicDataToProjectStructure(codeBlocksArray);

			expect(modules.length).toBe(2);
			expect(modules[0].code).toEqual(['module testModule', 'moduleEnd']);
			expect(modules[1].code).toEqual(['module testModuleTwo', 'moduleEnd']);
			expect(functions.length).toBe(1);
			expect(functions[0].code).toEqual(['function testFunc', 'functionEnd']);
		});
	});
});
