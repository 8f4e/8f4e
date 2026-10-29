import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import groupNonstickToggler from './effect';

describe('groupNonstickToggler', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	it('should add nonstick to @group directive in all group blocks when makeNonstick is true', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const block3 = createMockCodeBlock({
			code: ['module test3', '; @group other-group', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'other-group',
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2, block3];

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		expect(toggleCall).toBeDefined();

		const toggleCallback = toggleCall![1];
		toggleCallback({ codeBlock: block1, makeNonstick: true });

		// Both blocks in the group should have nonstick added
		expect(block1.code).toEqual(['module test1', '; @group audio-chain nonstick', '', 'moduleEnd']);
		expect(block2.code).toEqual(['module test2', '; @group audio-chain nonstick', '', 'moduleEnd']);
		// Block in different group should be unchanged
		expect(block3.code).toEqual(['module test3', '; @group other-group', '', 'moduleEnd']);
	});

	it('should remove nonstick from @group directive in all group blocks when makeNonstick is false', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '; @group audio-chain nonstick', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
			groupNonstick: true,
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '; @group audio-chain nonstick', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
			groupNonstick: true,
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1, makeNonstick: false });

		// Both blocks should have nonstick removed
		expect(block1.code).toEqual(['module test1', '; @group audio-chain', '', 'moduleEnd']);
		expect(block2.code).toEqual(['module test2', '; @group audio-chain', '', 'moduleEnd']);
	});

	it('should normalize nonstick state when some blocks are nonstick and others are not', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '; @group audio-chain nonstick', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
			groupNonstick: true,
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1, makeNonstick: true });

		// Block 1 should keep nonstick, block 2 should get nonstick
		expect(block1.code).toEqual(['module test1', '; @group audio-chain nonstick', '', 'moduleEnd']);
		expect(block2.code).toEqual(['module test2', '; @group audio-chain nonstick', '', 'moduleEnd']);
	});

	it('should handle @group directive with whitespace variations', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', ';   @group   audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1];

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1, makeNonstick: true });

		// Should add nonstick despite whitespace variations
		expect(block1.code).toEqual(['module test1', '; @group audio-chain nonstick', '', 'moduleEnd']);
	});

	it('should work with different block types', () => {
		const moduleBlock = createMockCodeBlock({
			code: ['module test1', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const functionBlock = createMockCodeBlock({
			code: ['function test2', '; @group audio-chain', '', 'functionEnd'],
			blockType: 'function',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [moduleBlock, functionBlock];

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: moduleBlock, makeNonstick: true });

		// Both blocks should be affected regardless of type
		expect(moduleBlock.code).toEqual(['module test1', '; @group audio-chain nonstick', '', 'moduleEnd']);
		expect(functionBlock.code).toEqual(['function test2', '; @group audio-chain nonstick', '', 'functionEnd']);
	});

	it('should not toggle when editing is disabled', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1];
		mockState.featureFlags.editing = false;

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1, makeNonstick: true });

		expect(block1.code).toEqual(['module test1', '; @group audio-chain', '', 'moduleEnd']);
	});

	it('should not toggle when code block has no group name', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '', 'moduleEnd'],
			blockType: 'module',
		});
		mockState.codeBlockRendering.codeBlocks = [block1];

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1, makeNonstick: true });

		expect(block1.code).toEqual(['module test1', '', 'moduleEnd']);
	});

	it('should update lastUpdated for all affected blocks', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
			lastUpdated: 1000,
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
			lastUpdated: 1000,
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1, makeNonstick: true });

		expect(block1.lastUpdated).toBeGreaterThan(1000);
		expect(block2.lastUpdated).toBeGreaterThan(1000);
	});

	it('should trigger store update for each affected block', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		const block2 = createMockCodeBlock({
			code: ['module test2', '; @group audio-chain', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1, block2];

		groupNonstickToggler(store, mockEvents);

		const setSpy = vi.spyOn(store, 'set');

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1, makeNonstick: true });

		// Once for each block, then the project revision advances once for the group.
		expect(setSpy).toHaveBeenCalledTimes(3);
		expect(setSpy).toHaveBeenLastCalledWith('projectChange', { revision: 1, kind: 'edit' });
		expect(setSpy).toHaveBeenCalledWith('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block1);
		expect(setSpy).toHaveBeenCalledWith('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block2);
	});

	it('should skip blocks with a bare ; @group directive (no group name)', () => {
		const block1 = createMockCodeBlock({
			code: ['module test1', '; @group', '', 'moduleEnd'],
			blockType: 'module',
			groupName: 'audio-chain',
		});
		mockState.codeBlockRendering.codeBlocks = [block1];

		groupNonstickToggler(store, mockEvents);

		const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
		const toggleCall = onCalls.find(call => call[0] === 'toggleGroupNonstick');
		const toggleCallback = toggleCall![1];

		toggleCallback({ codeBlock: block1, makeNonstick: true });

		// Malformed ; @group (no group name) must not produce '; @group undefined nonstick'
		expect(block1.code).toEqual(['module test1', '; @group', '', 'moduleEnd']);
	});
});
