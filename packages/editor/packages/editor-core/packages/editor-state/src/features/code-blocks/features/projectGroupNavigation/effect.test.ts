import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, type MockInstance } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import projectGroupNavigation, { findProjectSlicePath } from './effect';

describe('projectGroupNavigation', () => {
	it('derives the canonical path of a nested project slice', () => {
		const voices = [createMockCodeBlock({ name: 'voice' })];
		const audio = [createMockCodeBlock({ name: 'Voices', nestedProjectCodeBlocks: voices })];
		const root = [createMockCodeBlock({ name: 'Audio', nestedProjectCodeBlocks: audio })];

		expect(findProjectSlicePath(root, root)).toBe('');
		expect(findProjectSlicePath(root, audio)).toBe('Audio');
		expect(findProjectSlicePath(root, voices)).toBe('Audio/Voices');
	});

	it('opens a project group by pointing the rendered slice at its nested blocks', () => {
		const nestedProjectCodeBlocks = [createMockCodeBlock({ name: 'nested' })];
		const groupBlock = createMockCodeBlock({ nestedProjectCodeBlocks });
		const rootCodeBlocks = [groupBlock];
		const state = createMockState({
			codeBlockRendering: {
				rootCodeBlocks,
				codeBlocks: rootCodeBlocks,
				selectedCodeBlock: groupBlock,
				selectedCodeBlockForProgrammaticEdit: groupBlock,
				draggedCodeBlock: groupBlock,
			},
			viewport: { x: 64, y: 96 },
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const openGroup = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'openProjectGroup'
		)?.[1];
		openGroup({ codeBlock: groupBlock });

		expect(state.codeBlockRendering.rootCodeBlocks).toBe(rootCodeBlocks);
		expect(state.codeBlockRendering.codeBlocks).toBe(nestedProjectCodeBlocks);
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBeUndefined();
		expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(state.viewport.x).toBe(0);
		expect(state.viewport.y).toBe(0);
	});

	it('opens empty project groups', () => {
		const nestedProjectCodeBlocks: [] = [];
		const groupBlock = createMockCodeBlock({ nestedProjectCodeBlocks });
		const state = createMockState();
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const openGroup = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'openProjectGroup'
		)?.[1];
		openGroup({ codeBlock: groupBlock });

		expect(state.codeBlockRendering.codeBlocks).toBe(nestedProjectCodeBlocks);
	});

	it('returns to the immediate parent slice one level at a time', () => {
		const deepestSlice = [createMockCodeBlock({ name: 'deepest' })];
		const nestedGroup = createMockCodeBlock({ nestedProjectCodeBlocks: deepestSlice });
		const firstLevelSlice = [nestedGroup];
		const rootGroup = createMockCodeBlock({ nestedProjectCodeBlocks: firstLevelSlice });
		const rootCodeBlocks = [rootGroup];
		const state = createMockState({
			codeBlockRendering: {
				rootCodeBlocks,
				codeBlocks: deepestSlice,
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const goBack = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'goToParentProjectGroup'
		)?.[1];
		goBack();

		expect(state.codeBlockRendering.codeBlocks).toBe(firstLevelSlice);

		goBack();

		expect(state.codeBlockRendering.codeBlocks).toBe(rootCodeBlocks);
	});

	it('keeps the root slice active when there is no parent', () => {
		const state = createMockState();
		const rootCodeBlocks = state.codeBlockRendering.rootCodeBlocks;
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const goBack = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'goToParentProjectGroup'
		)?.[1];
		goBack();

		expect(state.codeBlockRendering.codeBlocks).toBe(rootCodeBlocks);
	});

	it('ignores ordinary code blocks when opening a group', () => {
		const state = createMockState();
		const originalSlice = state.codeBlockRendering.codeBlocks;
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const openGroup = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'openProjectGroup'
		)?.[1];
		openGroup({ codeBlock: createMockCodeBlock() });

		expect(state.codeBlockRendering.codeBlocks).toBe(originalSlice);
	});
});
