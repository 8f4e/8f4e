import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import { getProjectGroups } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import serializeProjectLevel from '../../../../pureHelpers/projectSerialization/serializeProjectLevel';
import codeBlockCreator from './effect';

describe('codeBlockCreator - copy/paste', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	describe('Copy project group', () => {
		it('copies and pastes the complete recursive project-group tree', async () => {
			let clipboardText = '';
			mockState.callbacks.writeClipboardText = vi.fn(async text => {
				clipboardText = text;
			});
			mockState.callbacks.readClipboardText = vi.fn(async () => clipboardText);
			mockState.codeBlockRendering.nextCodeBlockCreationIndex = 20;

			const nestedModule = createMockCodeBlock({
				name: 'voice',
				code: ['module voice', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				projectPath: 'audio/modulation',
				gridX: 4,
				gridY: 6,
				creationIndex: 4,
			});
			const nestedGroup = createMockCodeBlock({
				name: 'modulation',
				code: ['group modulation', '; nested comment', 'groupEnd'],
				entry: 'main',
				projectPath: 'audio',
				gridX: -3,
				gridY: 8,
				creationIndex: 3,
				childProject: { entries: ['main', 'empty'], path: '', blocks: [nestedModule] },
			});
			const module = createMockCodeBlock({
				name: 'output',
				code: ['module output', 'moduleEnd'],
				blockType: 'module',
				entry: 'main',
				projectPath: 'audio',
				gridX: 2,
				gridY: 3,
				creationIndex: 2,
			});
			const functionBlock = createMockCodeBlock({
				name: 'process',
				code: ['function process', 'functionEnd'],
				blockType: 'function',
				projectPath: 'audio',
				gridX: 12,
				gridY: 5,
				creationIndex: 1,
			});
			const group = createMockCodeBlock({
				name: 'audio',
				code: ['group audio', '; root comment', 'groupEnd'],
				entry: 'main',
				gridX: 10,
				gridY: 20,
				creationIndex: 0,
				childProject: { entries: ['main', 'foo', 'bar'], path: '', blocks: [module, functionBlock, nestedGroup] },
			});
			const rootCodeBlocks = [group];
			mockState.codeBlockRendering.rootProject.blocks = rootCodeBlocks;
			mockState.codeBlockRendering.currentProject.blocks = rootCodeBlocks;

			codeBlockCreator(store, mockEvents);
			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyCodeBlock = onCalls.find(call => call[0] === 'copyCodeBlock')![1];
			const pasteCodeBlocks = onCalls.find(call => call[0] === 'pasteCodeBlocks')![1];

			copyCodeBlock({ codeBlock: group });
			await new Promise(resolve => setTimeout(resolve, 0));
			expect(JSON.parse(clipboardText)[0].childProject?.blocks).toHaveLength(3);

			await pasteCodeBlocks({ x: 100, y: 100 });

			expect(rootCodeBlocks).toHaveLength(2);
			const pastedGroup = rootCodeBlocks[1];
			expect(pastedGroup).toMatchObject({
				name: 'audio1',
				entry: 'main',
				projectPath: '',
			});
			expect(pastedGroup.code).toContain('; root comment');
			expect(pastedGroup.childProject?.blocks).toHaveLength(3);
			expect(pastedGroup.childProject?.blocks?.[0]).toMatchObject({
				name: 'output',
				blockType: 'module',
				entry: 'main',
				projectPath: 'audio1',
				gridX: 2,
				gridY: 3,
			});
			expect(pastedGroup.childProject?.blocks?.[1]).toMatchObject({
				name: 'process',
				blockType: 'function',
				projectPath: 'audio1',
			});
			const pastedNestedGroup = pastedGroup.childProject?.blocks?.[2];
			expect(pastedNestedGroup).toMatchObject({
				name: 'modulation',
				projectPath: 'audio1',
			});
			expect(pastedNestedGroup?.code).toContain('; nested comment');
			expect(pastedNestedGroup?.childProject?.blocks[0]).toMatchObject({
				name: 'voice',
				blockType: 'module',
				entry: 'main',
				projectPath: 'audio1/modulation',
				gridX: 4,
				gridY: 6,
			});
			const pastedCreationIndexes = [
				pastedGroup.creationIndex,
				...pastedGroup.childProject!.blocks.flatMap(block => [
					block.creationIndex,
					...(block.childProject?.blocks?.map(child => child.creationIndex) ?? []),
				]),
			];
			expect(new Set(pastedCreationIndexes).size).toBe(pastedCreationIndexes.length);
			expect(Math.min(...pastedCreationIndexes)).toBe(20);

			const pastedProjectGroup = getProjectGroups(serializeProjectLevel(mockState.codeBlockRendering.rootProject))[1];
			expect(pastedProjectGroup).toMatchObject({
				entries: ['main', 'foo', 'bar'],
				name: 'audio1',
				entry: 'main',
				execution: [
					{
						type: 'group',
						entries: ['main', 'empty'],
						name: 'modulation',
						execution: [{ type: 'module', entry: 'main', code: expect.arrayContaining(['module voice']) }],
					},
					{ type: 'module', entry: 'main', code: expect.arrayContaining(['module output']) },
				],
				functions: [{ code: expect.arrayContaining(['function process']) }],
			});
		});
	});

	describe('Multi-block Paste', () => {
		it('applies plugin source transformations before resolving names and inserting the batch', async () => {
			const listeners = new Map<string, Array<(event: unknown) => void>>();
			const events: EventDispatcher = {
				on: (name, listener) => {
					const handlers = listeners.get(name) ?? [];
					handlers.push(listener as (event: unknown) => void);
					listeners.set(name, handlers);
				},
				off: (name, listener) => {
					listeners.set(
						name,
						(listeners.get(name) ?? []).filter(handler => handler !== listener)
					);
				},
				dispatch: (name, payload) => {
					for (const listener of listeners.get(name) ?? []) listener(payload);
				},
			};
			mockState.callbacks.readClipboardText = async () =>
				JSON.stringify([
					{ code: ['module original', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
					{ code: ['module second', 'moduleEnd'], gridCoordinates: { x: 5, y: 3 } },
				]);
			events.on<import('./pasteMultipleBlocks').TransformPastedCodeBlocksEvent>(
				'transformPastedCodeBlocks',
				incoming => {
					incoming.blocks = incoming.blocks.map(block => ({
						...block,
						code: ['module transformed', '; @custom data', 'moduleEnd'],
					}));
				}
			);
			codeBlockCreator(store, events);
			events.dispatch('pasteCodeBlocks', { x: 100, y: 100 });
			await vi.waitFor(() => {
				expect(mockState.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
					'transformed',
					'transformed2',
				]);
			});
			expect(
				mockState.codeBlockRendering.currentProject.blocks.every(block => block.code.includes('; @custom data'))
			).toBe(true);
			expect(mockState.projectChange.revision).toBe(1);
		});

		it('should detect and paste valid multi-block JSON array', async () => {
			const clipboardData = JSON.stringify([
				{ code: ['module foo', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', 'moduleEnd'], gridCoordinates: { x: 5, y: 3 } },
			]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;
			mockState.viewport.vGrid = 8;
			mockState.viewport.hGrid = 8;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			// Trigger paste at position (100, 100)
			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Verify two blocks were created
			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(2);

			// Verify first block is at paste anchor position
			const anchorGridX = Math.round(100 / 8);
			const anchorGridY = Math.round(100 / 8);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].gridX).toBe(anchorGridX);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].gridY).toBe(anchorGridY);

			// Verify second block has relative offset
			expect(mockState.codeBlockRendering.currentProject.blocks[1].gridX).toBe(anchorGridX + 5);
			expect(mockState.codeBlockRendering.currentProject.blocks[1].gridY).toBe(anchorGridY + 3);
		});

		it('should parse disabled state from @disabled directive on pasted blocks', async () => {
			const clipboardData = JSON.stringify([
				{ code: ['module foo', '; @disabled', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', 'moduleEnd'], gridCoordinates: { x: 5, y: 3 } },
			]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			expect(mockState.codeBlockRendering.currentProject.blocks[0].disabled).toBe(true);
			expect(mockState.codeBlockRendering.currentProject.blocks[1].disabled).toBe(false);
		});

		it('should fallback to single-block paste for invalid JSON', async () => {
			const clipboardData = 'module test\n\nmoduleEnd';

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Should create one block with plain text (now includes @pos)
			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(1);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[0]).toBe('module test');
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[1]).toMatch(/^; @pos \d+ \d+$/);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[2]).toBe('');
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[3]).toBe('moduleEnd');
		});

		it('should fallback to single-block paste for array with only 1 item', async () => {
			const clipboardData = JSON.stringify([{ code: ['module foo', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } }]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Should fallback to single paste
			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(1);
		});

		it('should update module names to avoid collisions', async () => {
			const existingBlock = createMockCodeBlock({
				name: 'foo',
				code: ['module foo', 'moduleEnd'],
			});
			mockState.codeBlockRendering.currentProject.blocks = [existingBlock];

			const clipboardData = JSON.stringify([
				{ code: ['module foo', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module foo', 'moduleEnd'], gridCoordinates: { x: 5, y: 0 } },
			]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Pasted blocks should have unique names
			expect(mockState.codeBlockRendering.currentProject.blocks[1].name).not.toBe('foo');
			expect(mockState.codeBlockRendering.currentProject.blocks[2].name).not.toBe('foo');
			expect(mockState.codeBlockRendering.currentProject.blocks[1].name).not.toBe(
				mockState.codeBlockRendering.currentProject.blocks[2].name
			);
		});

		it('should update inter-module references when pasted module names are renamed', async () => {
			const existingBlock = createMockCodeBlock({
				name: 'foo',
				code: ['module foo', 'moduleEnd'],
			});
			mockState.codeBlockRendering.currentProject.blocks = [existingBlock];

			const clipboardData = JSON.stringify([
				{ code: ['module foo', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{
					code: ['module consumer', 'int* source &foo:memoryItem', 'push count(foo:buffer)', 'moduleEnd'],
					gridCoordinates: { x: 5, y: 0 },
				},
			]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			expect(mockState.codeBlockRendering.currentProject.blocks[1].code[0]).toBe('module foo2');
			expect(mockState.codeBlockRendering.currentProject.blocks[2].code[2]).toBe('int* source &foo2:memoryItem');
			expect(mockState.codeBlockRendering.currentProject.blocks[2].code[3]).toBe('push count(foo2:buffer)');
		});

		it('preserves arbitrary directive source when pasting', async () => {
			const clipboardData = JSON.stringify([
				{ code: ['module foo', '; @custom audio mode', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', '; @custom audio mode', 'moduleEnd'], gridCoordinates: { x: 5, y: 0 } },
			]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Unregistered directive source remains intact after position insertion.
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[2]).toBe('; @custom audio mode');
			expect(mockState.codeBlockRendering.currentProject.blocks[1].code[2]).toBe('; @custom audio mode');
		});
	});
});
