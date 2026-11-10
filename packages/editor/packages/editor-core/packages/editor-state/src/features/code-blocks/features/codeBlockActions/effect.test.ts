import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import codeBlockActions from './effect';

describe('codeBlockActions - insertion', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;
	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});
	it.each(['module', 'function', 'prototype'])(
		'inserts duplicate %s names without rewriting source references',
		blockType => {
			mockState.codeBlockRendering.currentProject.blocks.push(
				createMockCodeBlock({ name: 'same', code: [`${blockType} same`, `${blockType}End`] })
			);
			codeBlockActions(store, mockEvents);
			const insert = vi.mocked(mockEvents.on).mock.calls.find(([name]) => name === 'insertCodeBlock')![1];
			insert({ x: 100, y: 100, code: [`${blockType} same`, 'push &same:value', `${blockType}End`] });
			const block = mockState.codeBlockRendering.currentProject.blocks.at(-1)!;
			expect(block.name).toBe('same');
			expect(block.code[0]).toBe(`${blockType} same`);
			expect(block.code).toContain('push &same:value');
		}
	);
	it('ignores insertion in view mode', () => {
		mockState.editorMode = 'view';
		codeBlockActions(store, mockEvents);
		vi.mocked(mockEvents.on).mock.calls.find(([name]) => name === 'insertCodeBlock')![1]({
			x: 100,
			y: 100,
			code: ['module supplied', 'moduleEnd'],
		});
		expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(0);
	});
	describe('module insertion entry assignment', () => {
		it('creates a new empty module assigned to a fresh execution entry outside existing entries', async () => {
			codeBlockActions(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const insertCodeBlockCall = onCalls.find(call => call[0] === 'insertCodeBlock');
			const insertCodeBlockCallback = insertCodeBlockCall![1];

			await insertCodeBlockCallback({ x: 100, y: 100, code: ['module supplied', 'moduleEnd'] });

			expect(mockState.codeBlockRendering.currentProject.blocks).toHaveLength(1);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].entry).toBe('entry');
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[0]).toBe('module supplied');
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code[1]).toMatch(/^; @pos \d+ \d+$/);
			expect(mockState.codeBlockRendering.currentProject.blocks[0].code.at(-1)).toBe('moduleEnd');
		});

		it.each([
			{ usedEntries: ['entry'], expected: 'entry2' },
			{ usedEntries: ['entry', 'entry2', 'entry4'], expected: 'entry3' },
			{ usedEntries: ['entry', ...Array.from({ length: 18 }, (_, index) => `entry${index + 2}`)], expected: 'entry20' },
		])('chooses $expected as the first available fresh entry', ({ usedEntries, expected }) => {
			mockState.codeBlockRendering.currentProject.blocks = usedEntries.map((entry, index) =>
				createMockCodeBlock({
					code: [`module existing${index}`, 'moduleEnd'],
					blockType: 'module',
					creationIndex: index,
					entry,
				})
			);
			mockState.codeBlockRendering.nextCodeBlockCreationIndex = usedEntries.length;
			codeBlockActions(store, mockEvents);
			const insert = vi.mocked(mockEvents.on).mock.calls.find(([name]) => name === 'insertCodeBlock')![1];
			insert({ x: 100, y: 100, code: ['module supplied', 'moduleEnd'] });
			expect(mockState.codeBlockRendering.currentProject.blocks.at(-1)!.entry).toBe(expected);
		});
	});
});

describe('codeBlockActions - toggleCodeBlockDisabled', () => {
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

		codeBlockActions(store, mockEvents);

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

		codeBlockActions(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.disabled).toBe(false);
	});

	it('should update lastUpdated for cache invalidation', () => {
		const codeBlock = createMockCodeBlock({ disabled: false, lastUpdated: 1000 });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockActions(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.lastUpdated).toBeGreaterThan(1000);
	});

	it('notifies the explicit source-update path', () => {
		const codeBlock = createMockCodeBlock({ disabled: false });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockActions(store, mockEvents);

		const dispatchSpy = vi.spyOn(mockEvents, 'dispatch');

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(dispatchSpy).toHaveBeenCalledWith('codeBlockSourcesChanged', { codeBlocks: [codeBlock] });
	});

	it('should not toggle when editing is disabled', () => {
		const codeBlock = createMockCodeBlock({ disabled: false });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];
		mockState.editorMode = 'view';

		codeBlockActions(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.disabled).toBe(false);
	});

	it('should add @disabled directive when enabling disabled', () => {
		const codeBlock = createMockCodeBlock({ code: ['module test', 'moduleEnd'], disabled: false });
		mockState.codeBlockRendering.currentProject.blocks = [codeBlock];

		codeBlockActions(store, mockEvents);

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

		codeBlockActions(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleCodeBlockDisabled');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock });

		expect(codeBlock.code).not.toContain('; @disabled');
		expect(codeBlock.disabled).toBe(false);
	});
});

describe('codeBlockActions - alwaysOnTop z-order partitioning', () => {
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

		codeBlockActions(store, mockEvents);

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

		codeBlockActions(store, mockEvents);

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
