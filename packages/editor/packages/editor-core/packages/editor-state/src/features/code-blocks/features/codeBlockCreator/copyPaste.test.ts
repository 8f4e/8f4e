import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import convertGraphicDataToProjectStructure from '../../../../pureHelpers/projectSerialization/serializeCodeBlocks';
import groupCopier from '../group/copier/effect';
import codeBlockCreator from './effect';

describe('codeBlockCreator - group copy/paste', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	describe('Copy Group', () => {
		it('should serialize group blocks as JSON array with relative coordinates', async () => {
			const mockWriteClipboard = vi.fn().mockResolvedValue(undefined);
			mockState.callbacks.writeClipboardText = mockWriteClipboard;

			const block1 = createMockCodeBlock({
				code: ['module foo', '; @group audio', 'moduleEnd'],
				gridX: 10,
				gridY: 20,
				groupName: 'audio',
			});

			const block2 = createMockCodeBlock({
				code: ['module bar', '; @group audio', 'moduleEnd'],
				gridX: 22,
				gridY: 24,
				groupName: 'audio',
			});

			mockState.codeBlockRendering.codeBlocks = [block1, block2];

			groupCopier(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyGroupCall = onCalls.find(call => call[0] === 'copyGroupBlocks');
			const copyGroupCallback = copyGroupCall![1];

			// Trigger copy group with block1 as anchor
			copyGroupCallback({ codeBlock: block1 });

			await new Promise(resolve => setTimeout(resolve, 0));

			// Verify clipboard was written with JSON array
			expect(mockWriteClipboard).toHaveBeenCalled();
			const clipboardContent = mockWriteClipboard.mock.calls[0][0];
			const parsed = JSON.parse(clipboardContent);

			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed).toHaveLength(2);

			// block1 should be anchor (0, 0)
			expect(parsed[0].code).toEqual(['module foo', '; @group audio', 'moduleEnd']);
			expect(parsed[0].gridCoordinates).toEqual({ x: 0, y: 0 });

			// block2 should have relative coordinates
			expect(parsed[1].code).toEqual(['module bar', '; @group audio', 'moduleEnd']);
			expect(parsed[1].gridCoordinates).toEqual({ x: 12, y: 4 });
		});

		it('should preserve disabled state via @disabled directive in code', async () => {
			const mockWriteClipboard = vi.fn().mockResolvedValue(undefined);
			mockState.callbacks.writeClipboardText = mockWriteClipboard;

			const block1 = createMockCodeBlock({
				code: ['module foo', '; @disabled', '; @group audio', 'moduleEnd'],
				gridX: 0,
				gridY: 0,
				groupName: 'audio',
				disabled: true,
			});

			mockState.codeBlockRendering.codeBlocks = [block1];

			groupCopier(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyGroupCall = onCalls.find(call => call[0] === 'copyGroupBlocks');
			const copyGroupCallback = copyGroupCall![1];

			copyGroupCallback({ codeBlock: block1 });
			await new Promise(resolve => setTimeout(resolve, 0));

			const clipboardContent = mockWriteClipboard.mock.calls[0][0];
			const parsed = JSON.parse(clipboardContent);

			expect(parsed[0].code).toContain('; @disabled');
			expect(parsed[0]).not.toHaveProperty('disabled');
		});

		it('should fallback to single copy when block has no group', async () => {
			const mockWriteClipboard = vi.fn().mockResolvedValue(undefined);
			mockState.callbacks.writeClipboardText = mockWriteClipboard;

			const block1 = createMockCodeBlock({
				code: ['module foo', 'moduleEnd'],
				groupName: undefined,
			});

			mockState.codeBlockRendering.codeBlocks = [block1];

			groupCopier(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyGroupCall = onCalls.find(call => call[0] === 'copyGroupBlocks');
			const copyGroupCallback = copyGroupCall![1];

			copyGroupCallback({ codeBlock: block1 });
			await new Promise(resolve => setTimeout(resolve, 0));

			// Should have written plain text, not JSON
			const clipboardContent = mockWriteClipboard.mock.calls[0][0];
			expect(clipboardContent).toBe('module foo\nmoduleEnd');
		});

		it('should order blocks by creation index', async () => {
			const mockWriteClipboard = vi.fn().mockResolvedValue(undefined);
			mockState.callbacks.writeClipboardText = mockWriteClipboard;

			const block1 = createMockCodeBlock({
				code: ['module foo', '; @group audio', 'moduleEnd'],
				groupName: 'audio',
				creationIndex: 2,
			});

			const block2 = createMockCodeBlock({
				code: ['module bar', '; @group audio', 'moduleEnd'],
				groupName: 'audio',
				creationIndex: 1,
			});

			const block3 = createMockCodeBlock({
				code: ['module baz', '; @group audio', 'moduleEnd'],
				groupName: 'audio',
				creationIndex: 3,
			});

			mockState.codeBlockRendering.codeBlocks = [block1, block2, block3];

			groupCopier(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyGroupCall = onCalls.find(call => call[0] === 'copyGroupBlocks');
			const copyGroupCallback = copyGroupCall![1];

			copyGroupCallback({ codeBlock: block1 });
			await new Promise(resolve => setTimeout(resolve, 0));

			const clipboardContent = mockWriteClipboard.mock.calls[0][0];
			const parsed = JSON.parse(clipboardContent);

			// Should be ordered by creation index: block2, block1, block3
			expect(parsed[0].code[0]).toBe('module bar');
			expect(parsed[1].code[0]).toBe('module foo');
			expect(parsed[2].code[0]).toBe('module baz');
		});
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
				nestedProjectCodeBlocks: [nestedModule],
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
				nestedProjectCodeBlocks: [module, functionBlock, nestedGroup],
			});
			const rootCodeBlocks = [group];
			mockState.codeBlockRendering.rootCodeBlocks = rootCodeBlocks;
			mockState.codeBlockRendering.codeBlocks = rootCodeBlocks;

			codeBlockCreator(store, mockEvents);
			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyCodeBlock = onCalls.find(call => call[0] === 'copyCodeBlock')![1];
			const pasteCodeBlocks = onCalls.find(call => call[0] === 'pasteCodeBlocks')![1];

			copyCodeBlock({ codeBlock: group });
			await new Promise(resolve => setTimeout(resolve, 0));
			expect(JSON.parse(clipboardText)[0].nestedProjectCodeBlocks).toHaveLength(3);

			await pasteCodeBlocks({ x: 100, y: 100 });

			expect(rootCodeBlocks).toHaveLength(2);
			const pastedGroup = rootCodeBlocks[1];
			expect(pastedGroup).toMatchObject({
				name: 'audio1',
				entry: 'main',
				projectPath: '',
			});
			expect(pastedGroup.code).toContain('; root comment');
			expect(pastedGroup.nestedProjectCodeBlocks).toHaveLength(3);
			expect(pastedGroup.nestedProjectCodeBlocks?.[0]).toMatchObject({
				name: 'output',
				blockType: 'module',
				entry: 'main',
				projectPath: 'audio1',
				gridX: 2,
				gridY: 3,
			});
			expect(pastedGroup.nestedProjectCodeBlocks?.[1]).toMatchObject({
				name: 'process',
				blockType: 'function',
				projectPath: 'audio1',
			});
			const pastedNestedGroup = pastedGroup.nestedProjectCodeBlocks?.[2];
			expect(pastedNestedGroup).toMatchObject({
				name: 'modulation',
				projectPath: 'audio1',
			});
			expect(pastedNestedGroup?.code).toContain('; nested comment');
			expect(pastedNestedGroup?.nestedProjectCodeBlocks?.[0]).toMatchObject({
				name: 'voice',
				blockType: 'module',
				entry: 'main',
				projectPath: 'audio1/modulation',
				gridX: 4,
				gridY: 6,
			});
			const pastedCreationIndexes = [
				pastedGroup.creationIndex,
				...pastedGroup.nestedProjectCodeBlocks!.flatMap(block => [
					block.creationIndex,
					...(block.nestedProjectCodeBlocks?.map(child => child.creationIndex) ?? []),
				]),
			];
			expect(new Set(pastedCreationIndexes).size).toBe(pastedCreationIndexes.length);
			expect(Math.min(...pastedCreationIndexes)).toBe(20);

			const pastedProjectGroup = convertGraphicDataToProjectStructure(rootCodeBlocks).groups[1];
			expect(pastedProjectGroup).toMatchObject({
				name: 'audio1',
				entry: 'main',
				modules: [{ entry: 'main', code: expect.arrayContaining(['module output']) }],
				functions: [{ code: expect.arrayContaining(['function process']) }],
				groups: [
					{
						name: 'modulation',
						modules: [{ entry: 'main', code: expect.arrayContaining(['module voice']) }],
					},
				],
			});
		});
	});

	describe('Multi-block Paste', () => {
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
			expect(mockState.codeBlockRendering.codeBlocks).toHaveLength(2);

			// Verify first block is at paste anchor position
			const anchorGridX = Math.round(100 / 8);
			const anchorGridY = Math.round(100 / 8);
			expect(mockState.codeBlockRendering.codeBlocks[0].gridX).toBe(anchorGridX);
			expect(mockState.codeBlockRendering.codeBlocks[0].gridY).toBe(anchorGridY);

			// Verify second block has relative offset
			expect(mockState.codeBlockRendering.codeBlocks[1].gridX).toBe(anchorGridX + 5);
			expect(mockState.codeBlockRendering.codeBlocks[1].gridY).toBe(anchorGridY + 3);
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

			expect(mockState.codeBlockRendering.codeBlocks[0].disabled).toBe(true);
			expect(mockState.codeBlockRendering.codeBlocks[1].disabled).toBe(false);
		});

		it('should rename colliding group names on paste', async () => {
			// Existing block with group name "audio"
			const existingBlock = createMockCodeBlock({
				code: ['module existing', '; @group audio', 'moduleEnd'],
				groupName: 'audio',
			});
			mockState.codeBlockRendering.codeBlocks = [existingBlock];

			// Paste blocks with same group name
			const clipboardData = JSON.stringify([
				{ code: ['module foo', '; @group audio', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', '; @group audio', 'moduleEnd'], gridCoordinates: { x: 5, y: 3 } },
			]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Original block should still have "audio" at line 1
			expect(mockState.codeBlockRendering.codeBlocks[0].code[1]).toBe('; @group audio');

			// Pasted blocks should have renamed group "audio1" at line 2 (after @pos)
			expect(mockState.codeBlockRendering.codeBlocks[1].code[2]).toBe('; @group audio1');
			expect(mockState.codeBlockRendering.codeBlocks[2].code[2]).toBe('; @group audio1');
		});

		it('should handle multiple different group names in paste', async () => {
			const existingBlock1 = createMockCodeBlock({
				code: ['module existing1', '; @group audio', 'moduleEnd'],
				groupName: 'audio',
			});
			const existingBlock2 = createMockCodeBlock({
				code: ['module existing2', '; @group video', 'moduleEnd'],
				groupName: 'video',
			});
			mockState.codeBlockRendering.codeBlocks = [existingBlock1, existingBlock2];

			const clipboardData = JSON.stringify([
				{ code: ['module foo', '; @group audio', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', '; @group video', 'moduleEnd'], gridCoordinates: { x: 5, y: 0 } },
				{ code: ['module baz', '; @group audio', 'moduleEnd'], gridCoordinates: { x: 10, y: 0 } },
			]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// audio -> audio1, video -> video1 (now at line 2 after @pos)
			expect(mockState.codeBlockRendering.codeBlocks[2].code[2]).toBe('; @group audio1');
			expect(mockState.codeBlockRendering.codeBlocks[3].code[2]).toBe('; @group video1');
			expect(mockState.codeBlockRendering.codeBlocks[4].code[2]).toBe('; @group audio1'); // Same as first
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
			expect(mockState.codeBlockRendering.codeBlocks).toHaveLength(1);
			expect(mockState.codeBlockRendering.codeBlocks[0].code[0]).toBe('module test');
			expect(mockState.codeBlockRendering.codeBlocks[0].code[1]).toMatch(/^; @pos \d+ \d+$/);
			expect(mockState.codeBlockRendering.codeBlocks[0].code[2]).toBe('');
			expect(mockState.codeBlockRendering.codeBlocks[0].code[3]).toBe('moduleEnd');
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
			expect(mockState.codeBlockRendering.codeBlocks).toHaveLength(1);
		});

		it('should update module names to avoid collisions', async () => {
			const existingBlock = createMockCodeBlock({
				name: 'foo',
				code: ['module foo', 'moduleEnd'],
			});
			mockState.codeBlockRendering.codeBlocks = [existingBlock];

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
			expect(mockState.codeBlockRendering.codeBlocks[1].name).not.toBe('foo');
			expect(mockState.codeBlockRendering.codeBlocks[2].name).not.toBe('foo');
			expect(mockState.codeBlockRendering.codeBlocks[1].name).not.toBe(mockState.codeBlockRendering.codeBlocks[2].name);
		});

		it('should update inter-module references when pasted module names are renamed', async () => {
			const existingBlock = createMockCodeBlock({
				name: 'foo',
				code: ['module foo', 'moduleEnd'],
			});
			mockState.codeBlockRendering.codeBlocks = [existingBlock];

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

			expect(mockState.codeBlockRendering.codeBlocks[1].code[0]).toBe('module foo2');
			expect(mockState.codeBlockRendering.codeBlocks[2].code[2]).toBe('int* source &foo2:memoryItem');
			expect(mockState.codeBlockRendering.codeBlocks[2].code[3]).toBe('push count(foo2:buffer)');
		});

		it('should preserve nonstick flag in group directive', async () => {
			const clipboardData = JSON.stringify([
				{ code: ['module foo', '; @group audio nonstick', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', '; @group audio nonstick', 'moduleEnd'], gridCoordinates: { x: 5, y: 0 } },
			]);

			const mockReadClipboard = vi.fn().mockResolvedValue(clipboardData);
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Nonstick flag should be preserved (now at index 2 after @pos)
			expect(mockState.codeBlockRendering.codeBlocks[0].code[2]).toContain('nonstick');
			expect(mockState.codeBlockRendering.codeBlocks[1].code[2]).toContain('nonstick');
		});
	});
});
