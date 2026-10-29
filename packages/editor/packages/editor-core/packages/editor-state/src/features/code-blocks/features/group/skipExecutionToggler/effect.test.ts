import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import groupSkipExecutionToggler from './effect';

describe('groupSkipExecutionToggler', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	it('should insert #skipExecution directive in all group module blocks when none are skipped', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const block3 = createMockCodeBlock({
			code: ['module test3', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'other-group',
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2, block3];

		groupSkipExecutionToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupSkipExecutionDirective');
		expect(toggleCall).toBeDefined();

		const toggleCallback = toggleCall![1];
		toggleCallback({ codeBlock: block1 });

		// Both blocks in the group should have the directive
		expect(block1.code).toEqual(['module test1', '#skipExecution', '', 'moduleEnd']);
		expect(block2.code).toEqual(['module test2', '#skipExecution', '', 'moduleEnd']);
		// Block in different group should be unchanged
		expect(block3.code).toEqual(['module test3', '', 'moduleEnd']);
	});

	it('should remove #skipExecution directive from all group blocks when all are skipped', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '#skipExecution', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '#skipExecution', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupSkipExecutionToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupSkipExecutionDirective');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1 });

		// Both blocks should have directive removed
		expect(block1.code).toEqual(['module test1', '', 'moduleEnd']);
		expect(block2.code).toEqual(['module test2', '', 'moduleEnd']);
	});

	it('should skip all blocks when some are already skipped', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '#skipExecution', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupSkipExecutionToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupSkipExecutionDirective');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1 });

		// Block 1 should keep directive, block 2 should get directive
		expect(block1.code).toEqual(['module test1', '#skipExecution', '', 'moduleEnd']);
		expect(block2.code).toEqual(['module test2', '#skipExecution', '', 'moduleEnd']);
	});

	it('should only affect module blocks in mixed group', () => {
		const moduleBlock = createMockCodeBlock({
			code: ['module test1', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const functionBlock = createMockCodeBlock({
			code: ['function test2', '', 'functionEnd'],
			blockType: 'function',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [moduleBlock, functionBlock];

		groupSkipExecutionToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupSkipExecutionDirective');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: moduleBlock });

		// Only module should be affected
		expect(moduleBlock.code).toEqual(['module test1', '#skipExecution', '', 'moduleEnd']);
		// Function block should be unchanged
		expect(functionBlock.code).toEqual(['function test2', '', 'functionEnd']);
	});

	it('should not toggle when editing is disabled', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1];
		mockState.featureFlags.editing = false;

		groupSkipExecutionToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupSkipExecutionDirective');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1 });

		expect(block1.code).toEqual(['module test1', '', 'moduleEnd']);
	});

	it('should not toggle when code block has no group name', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '', 'moduleEnd'],
			blockType: 'module',
		});
		mockState.codeBlockRendering.codeBlocks = [block1];

		groupSkipExecutionToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupSkipExecutionDirective');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1 });

		expect(block1.code).toEqual(['module test1', '', 'moduleEnd']);
	});

	it('should update lastUpdated for all affected blocks', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
			lastUpdated: 1000,
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
			lastUpdated: 1000,
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupSkipExecutionToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupSkipExecutionDirective');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1 });

		expect(block1.lastUpdated).toBeGreaterThan(1000);
		expect(block2.lastUpdated).toBeGreaterThan(1000);
	});

	it('should trigger store update for each affected block', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupSkipExecutionToggler(store, mockEvents);

		const setSpy = vi.spyOn(store, 'set');

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupSkipExecutionDirective');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1 });

		// Update each block, then advance the compiler input and project revisions once for the group.
		expect(setSpy).toHaveBeenCalledTimes(4);
		expect(setSpy).toHaveBeenCalledWith('compilerInputRevision', 1);
		expect(setSpy).toHaveBeenLastCalledWith('projectChange', { revision: 1, kind: 'edit' });
		expect(setSpy).toHaveBeenCalledWith('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block1);
		expect(setSpy).toHaveBeenCalledWith('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block2);
	});
});
