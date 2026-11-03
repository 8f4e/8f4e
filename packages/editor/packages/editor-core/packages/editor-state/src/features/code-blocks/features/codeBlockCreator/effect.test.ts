import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import codeBlockCreator from './effect';

describe('codeBlockCreator - creation and clipboard actions', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	describe('explicit block actions', () => {
		it.each([
			['module', 'moduleEnd'],
			['function', 'functionEnd'],
			['prototype', 'prototypeEnd'],
			['note', 'noteEnd'],
		])('creates a %s template without reading the clipboard', (blockType, end) => {
			const readClipboardText = vi.fn();
			mockState.callbacks.readClipboardText = readClipboardText;
			codeBlockCreator(store, mockEvents);
			const create = vi.mocked(mockEvents.on).mock.calls.find(([name]) => name === 'createCodeBlock')![1];
			create({ x: 100, y: 100, blockType });
			const block = mockState.codeBlockRendering.currentProject.blocks[0];
			expect(block.blockType).toBe(blockType);
			expect(block.code[0]).toMatch(new RegExp(`^${blockType}(?: |$)`));
			expect(block.code.at(-1)).toBe(end);
			expect(readClipboardText).not.toHaveBeenCalled();
		});

		it('inserts supplied single-line source without treating it as a paste request', () => {
			const readClipboardText = vi.fn().mockResolvedValue('module clipboard\nmoduleEnd');
			mockState.callbacks.readClipboardText = readClipboardText;
			codeBlockCreator(store, mockEvents);
			const insert = vi.mocked(mockEvents.on).mock.calls.find(([name]) => name === 'insertCodeBlock')![1];
			insert({ x: 100, y: 100, code: ['; Supplied source'] });
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code).toContain('; Supplied source');
			expect(readClipboardText).not.toHaveBeenCalled();
		});

		it.each([
			['createCodeBlock', { x: 100, y: 100, blockType: 'module' }],
			['insertCodeBlock', { x: 100, y: 100, code: ['module supplied', 'moduleEnd'] }],
			['pasteCodeBlocks', { x: 100, y: 100 }],
		])('does not edit or read the clipboard in view mode: %s', async (action, payload) => {
			mockState.editorMode = 'view';
			const readClipboardText = vi.fn().mockResolvedValue('module clipboard\nmoduleEnd');
			mockState.callbacks.readClipboardText = readClipboardText;
			codeBlockCreator(store, mockEvents);
			await vi
				.mocked(mockEvents.on)
				.mock.calls.find(([name]) => name === action)![1](payload);
			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(0);
			expect(readClipboardText).not.toHaveBeenCalled();
		});
	});

	describe('Paste Code Block (readClipboardText callback)', () => {
		it('should read from clipboard callback when pasting a module', async () => {
			const mockReadClipboard = vi.fn().mockResolvedValue('module test\n\nmoduleEnd');
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			// Find the pasteCodeBlocks event handler
			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			expect(pasteCodeBlocksCall).toBeDefined();

			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			// Read clipboard content through the explicit paste action
			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Verify clipboard was read
			expect(mockReadClipboard).toHaveBeenCalled();

			// Verify code block was added with clipboard content (now includes @pos)
			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(1);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[0]).toBe('module test');
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[1]).toMatch(/^; @pos \d+ \d+$/);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[2]).toBe('');
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[3]).toBe('moduleEnd');
		});

		it('should fail silently when readClipboardText is not provided', async () => {
			mockState.callbacks.readClipboardText = undefined;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			// Read clipboard content through the explicit paste action
			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Verify no code block was added
			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(0);
		});

		it('should fail silently when clipboard read fails', async () => {
			const mockReadClipboard = vi.fn().mockRejectedValue(new Error('Clipboard read failed'));
			mockState.callbacks.readClipboardText = mockReadClipboard;

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const pasteCodeBlocksCall = onCalls.find(call => call[0] === 'pasteCodeBlocks');
			const pasteCodeBlocksCallback = pasteCodeBlocksCall![1];

			// Read clipboard content through the explicit paste action
			await pasteCodeBlocksCallback({ x: 100, y: 100 });

			// Verify clipboard was attempted
			expect(mockReadClipboard).toHaveBeenCalled();

			// Verify no code block was added (silent failure)
			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(0);
		});
	});

	describe('New Module entry assignment', () => {
		it('creates a new empty module assigned to a fresh execution entry outside existing entries', async () => {
			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const createCodeBlockCall = onCalls.find(call => call[0] === 'createCodeBlock');
			const createCodeBlockCallback = createCodeBlockCall![1];

			await createCodeBlockCallback({ x: 100, y: 100, blockType: 'module' });

			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(1);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].entry).toBe('entry');
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[0]).toMatch(/^module \w+$/);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[1]).toMatch(/^; @pos \d+ \d+$/);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code.at(-1)).toBe('moduleEnd');
		});

		it('increments the entry name when creating outside entries and the default new entry name is already used', async () => {
			mockState.codeBlockRendering.currentProject.blocks = [
				createMockCodeBlock({
					code: ['module existing', 'moduleEnd'],
					blockType: 'module',
					entry: 'entry',
				}),
			];

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const createCodeBlockCall = onCalls.find(call => call[0] === 'createCodeBlock');
			const createCodeBlockCallback = createCodeBlockCall![1];

			await createCodeBlockCallback({ x: 100, y: 100, blockType: 'module' });

			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(2);
			expect(mockState.codeBlockRendering.currentProject.blocks[1].entry).toBe('entry2');
		});

		it('assigns a regular new module to the containing non-main entry', async () => {
			mockState.codeBlockRendering.entryOutlines = [
				{
					entryName: 'fx',
					topLeft: { x: 0, y: 0 },
					topRight: { x: 200, y: 0 },
					bottomRight: { x: 200, y: 200 },
					bottomLeft: { x: 0, y: 200 },
				},
			];

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const createCodeBlockCall = onCalls.find(call => call[0] === 'createCodeBlock');
			const createCodeBlockCallback = createCodeBlockCall![1];

			await createCodeBlockCallback({ x: 100, y: 100, blockType: 'module' });

			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(1);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].entry).toBe('fx');
		});

		it('uses the first overlapping entry outline at the new module position', async () => {
			mockState.codeBlockRendering.entryOutlines = [
				{
					entryName: 'first',
					topLeft: { x: 0, y: 0 },
					topRight: { x: 200, y: 0 },
					bottomRight: { x: 200, y: 200 },
					bottomLeft: { x: 0, y: 200 },
				},
				{
					entryName: 'second',
					topLeft: { x: 0, y: 0 },
					topRight: { x: 200, y: 0 },
					bottomRight: { x: 200, y: 200 },
					bottomLeft: { x: 0, y: 200 },
				},
			];

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const createCodeBlockCall = onCalls.find(call => call[0] === 'createCodeBlock');
			const createCodeBlockCallback = createCodeBlockCall![1];

			await createCodeBlockCallback({ x: 100, y: 100, blockType: 'module' });

			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(1);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].entry).toBe('first');
		});

		it('stores the main entry explicitly', async () => {
			mockState.codeBlockRendering.entryOutlines = [
				{
					entryName: 'main',
					topLeft: { x: 0, y: 0 },
					topRight: { x: 200, y: 0 },
					bottomRight: { x: 200, y: 200 },
					bottomLeft: { x: 0, y: 200 },
				},
			];

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const createCodeBlockCall = onCalls.find(call => call[0] === 'createCodeBlock');
			const createCodeBlockCallback = createCodeBlockCall![1];

			await createCodeBlockCallback({ x: 100, y: 100, blockType: 'module' });

			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(1);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].entry).toBe('main');
		});
	});

	describe('Copy Module (writeClipboardText callback)', () => {
		it('should write to clipboard callback when copying a module', async () => {
			const mockWriteClipboard = vi.fn().mockResolvedValue(undefined);
			mockState.callbacks.writeClipboardText = mockWriteClipboard;

			// Add a code block to copy
			const testCodeBlock = createMockCodeBlock({
				name: 'test',
				code: ['module test', '', 'moduleEnd'],
				blockType: 'module',
			});
			mockState.codeBlockRendering.currentProject.blocks = [testCodeBlock];

			codeBlockCreator(store, mockEvents);

			// Find the copyCodeBlock event handler
			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyCodeBlockCall = onCalls.find(call => call[0] === 'copyCodeBlock');
			expect(copyCodeBlockCall).toBeDefined();

			const copyCodeBlockCallback = copyCodeBlockCall![1];

			// Trigger copy
			copyCodeBlockCallback({ codeBlock: mockState.codeBlockRendering.currentProject.blocks[0] });

			// Wait for async operation
			await new Promise(resolve => setTimeout(resolve, 0));

			// Verify clipboard was written
			expect(mockWriteClipboard).toHaveBeenCalledWith('module test\n\nmoduleEnd');
		});

		it('should fail silently when writeClipboardText is not provided', () => {
			mockState.callbacks.writeClipboardText = undefined;

			// Add a code block to copy
			const testCodeBlock = createMockCodeBlock({
				name: 'test',
				code: ['module test', '', 'moduleEnd'],
				blockType: 'module',
			});
			mockState.codeBlockRendering.currentProject.blocks = [testCodeBlock];

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyCodeBlockCall = onCalls.find(call => call[0] === 'copyCodeBlock');
			const copyCodeBlockCallback = copyCodeBlockCall![1];

			// Trigger copy - should not throw
			expect(() => {
				copyCodeBlockCallback({ codeBlock: mockState.codeBlockRendering.currentProject.blocks[0] });
			}).not.toThrow();
		});

		it('should fail silently when clipboard write fails', async () => {
			const mockWriteClipboard = vi.fn().mockRejectedValue(new Error('Clipboard write failed'));
			mockState.callbacks.writeClipboardText = mockWriteClipboard;

			// Add a code block to copy
			const testCodeBlock = createMockCodeBlock({
				name: 'test',
				code: ['module test', '', 'moduleEnd'],
				blockType: 'module',
			});
			mockState.codeBlockRendering.currentProject.blocks = [testCodeBlock];

			codeBlockCreator(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const copyCodeBlockCall = onCalls.find(call => call[0] === 'copyCodeBlock');
			const copyCodeBlockCallback = copyCodeBlockCall![1];

			// Trigger copy
			copyCodeBlockCallback({ codeBlock: mockState.codeBlockRendering.currentProject.blocks[0] });

			// Wait for async operation
			await new Promise(resolve => setTimeout(resolve, 0));

			// Verify clipboard write was attempted
			expect(mockWriteClipboard).toHaveBeenCalled();
			// No error should be thrown (silent failure)
		});
	});
});

describe('codeBlockCreator - toggleCodeBlockDisabled', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	it('should toggle disabled state from false to true', () => {
		const codeBlock = createMockCodeBlock({ disabled: false });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockCreator(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		expect(toggleCall).toBeDefined();

		const toggleCallback = toggleCall![1];
		toggleCallback({ codeBlock });

		expect(codeBlock.disabled).toBe(true);
	});

	it('should toggle disabled state from true to false', () => {
		const codeBlock = createMockCodeBlock({ disabled: true });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockCreator(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.disabled).toBe(false);
	});

	it('should update lastUpdated for cache invalidation', () => {
		const codeBlock = createMockCodeBlock({ disabled: false, lastUpdated: 1000 });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockCreator(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.lastUpdated).toBeGreaterThan(1000);
	});

	it('should trigger store update', () => {
		const codeBlock = createMockCodeBlock({ disabled: false });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockCreator(store, mockEvents);

		const setSpy = vi.spyOn(store, 'set');

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(setSpy).toHaveBeenCalledWith('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', codeBlock);
	});

	it('should not toggle when editing is disabled', () => {
		const codeBlock = createMockCodeBlock({ disabled: false });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];
		mockState.editorMode = 'view';

		codeBlockCreator(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.disabled).toBe(false);
	});

	it('should add @disabled directive when enabling disabled', () => {
		const codeBlock = createMockCodeBlock({ code: ['module test', 'moduleEnd'], disabled: false });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockCreator(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.code).toContain('; @disabled');
		expect(codeBlock.disabled).toBe(true);
	});

	it('should remove @disabled directive when disabling disabled', () => {
		const codeBlock = createMockCodeBlock({ code: ['module test', '; @disabled', 'moduleEnd'], disabled: true });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockCreator(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.code).not.toContain('; @disabled');
		expect(codeBlock.disabled).toBe(false);
	});
});

describe('codeBlockCreator - alwaysOnTop z-order partitioning', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	it('inserts a normal block before existing always-on-top blocks', async () => {
		const existingNormal = createMockCodeBlock({ name: 'normal1', alwaysOnTop: false });
		const existingTop = createMockCodeBlock({ name: 'top1', alwaysOnTop: true });
		mockState.codeBlockRendering.currentProject.blocks = [existingNormal, existingTop];

		codeBlockCreator(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const insertCodeBlockCallback = onCalls.find(call => call[0] === 'insertCodeBlock')![1];

		await insertCodeBlockCallback({
			x: 100,
			y: 100,
			code: ['module normal2', 'moduleEnd'],
		});

		expect(mockState.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
			'normal1',
			'normal2',
			'top1',
		]);
		expect(mockState.codeBlockRendering.currentProject.blocks[1].alwaysOnTop).toBe(false);
	});

	it('derives alwaysOnTop and inserts an @alwaysOnTop block directly into the top partition', async () => {
		const existingNormal = createMockCodeBlock({ name: 'normal1', alwaysOnTop: false });
		const existingTop = createMockCodeBlock({ name: 'top1', alwaysOnTop: true });
		mockState.codeBlockRendering.currentProject.blocks = [existingNormal, existingTop];

		codeBlockCreator(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const insertCodeBlockCallback = onCalls.find(call => call[0] === 'insertCodeBlock')![1];

		await insertCodeBlockCallback({
			x: 100,
			y: 100,
			code: ['module top2', '; @alwaysOnTop', 'moduleEnd'],
		});

		expect(mockState.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
			'normal1',
			'top1',
			'top2',
		]);
		expect(mockState.codeBlockRendering.currentProject.blocks[2].alwaysOnTop).toBe(true);
	});
});
