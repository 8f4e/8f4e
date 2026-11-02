import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, type MockInstance, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import animateViewport from '../../../viewport/animateViewport';
import projectGroupNavigation from './effect';

describe('projectGroupNavigation', () => {
	function setupNavigation(rootCodeBlocks: CodeBlockGraphicData[]) {
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: rootCodeBlocks },
				currentProject: { entries: [], path: '', blocks: rootCodeBlocks },
			},
			viewport: { x: 64, y: -96, width: 800, height: 600 },
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();
		projectGroupNavigation(store, events);
		const dispatch = (name: string, payload: unknown = {}) => {
			for (const [eventName, handler] of vi.mocked(events.on).mock.calls) {
				if (eventName === name) handler(payload);
			}
		};
		return { state, store, events, dispatch };
	}

	it('restores the latest selection at each level, including an explicitly cleared selection', () => {
		const child = createMockCodeBlock({ name: 'oscillator' });
		const group = createMockCodeBlock({ name: 'Audio', childProject: { entries: [], path: 'Audio', blocks: [child] } });
		const { state, dispatch } = setupNavigation([group]);
		state.codeBlockRendering.selectedCodeBlock = group;
		const revision = state.projectChange.revision;

		dispatch('openProjectGroup', { codeBlock: group });
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		state.codeBlockRendering.selectedCodeBlock = child;
		dispatch('goToParentProjectGroup');
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(group);

		dispatch('openProjectGroup', { codeBlock: group });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(child);
		state.codeBlockRendering.selectedCodeBlock = undefined;
		dispatch('goToParentProjectGroup');
		state.codeBlockRendering.selectedCodeBlock = undefined;
		dispatch('openProjectGroup', { codeBlock: group });
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		dispatch('goToParentProjectGroup');
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(state.projectChange.revision).toBe(revision);
	});

	it('does not restore a remembered block that was deleted while viewing another level', () => {
		const group = createMockCodeBlock({ name: 'Audio', childProject: { entries: [], path: 'Audio', blocks: [] } });
		const removed = createMockCodeBlock({ name: 'removed' });
		const { state, dispatch } = setupNavigation([group, removed]);
		state.codeBlockRendering.selectedCodeBlock = removed;
		dispatch('openProjectGroup', { codeBlock: group });
		state.codeBlockRendering.rootProject.blocks.pop();

		dispatch('goToParentProjectGroup');

		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(state.codeBlockRendering.rootProject.selectedBlock).toBeUndefined();
	});

	it('restores the latest viewport of the parent and revisited group instead of their home blocks', () => {
		const group = createMockCodeBlock({
			name: 'Audio',
			isHome: true,
			x: 2000,
			childProject: { entries: [], path: '', blocks: [createMockCodeBlock({ isHome: true, x: 1000 })] },
		});
		const { state, events, dispatch } = setupNavigation([group]);
		const revision = state.projectChange.revision;

		dispatch('openProjectGroup', { codeBlock: group });
		Object.assign(state.viewport, { x: -320, y: 160 });
		dispatch('goToParentProjectGroup');

		expect(state.viewport).toMatchObject({ x: 64, y: -96 });
		expect(events.dispatch).toHaveBeenLastCalledWith('viewportChanged', {
			previousX: -320,
			previousY: 160,
			x: 64,
			y: -96,
		});

		Object.assign(state.viewport, { x: 128, y: 192 });
		dispatch('openProjectGroup', { codeBlock: group });
		expect(state.viewport).toMatchObject({ x: -320, y: 160 });
		dispatch('goToParentProjectGroup');
		expect(state.viewport).toMatchObject({ x: 128, y: 192 });
		expect(state.projectChange.revision).toBe(revision);
	});

	it('keeps independent positions at each depth when jumping directly to the root', () => {
		const nestedGroup = createMockCodeBlock({ name: 'Voices', childProject: { entries: [], path: '', blocks: [] } });
		const group = createMockCodeBlock({
			name: 'Audio',
			childProject: { entries: [], path: '', blocks: [nestedGroup] },
		});
		const { state, dispatch } = setupNavigation([group]);

		state.codeBlockRendering.selectedCodeBlock = group;
		dispatch('openProjectGroup', { codeBlock: group });
		Object.assign(state.viewport, { x: 128, y: 256 });
		state.codeBlockRendering.selectedCodeBlock = nestedGroup;
		dispatch('openProjectGroup', { codeBlock: nestedGroup });
		Object.assign(state.viewport, { x: 512, y: -640 });
		dispatch('goToRootProjectGroup');
		expect(state.viewport).toMatchObject({ x: 64, y: -96 });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(group);

		dispatch('openProjectGroup', { codeBlock: group });
		expect(state.viewport).toMatchObject({ x: 128, y: 256 });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(nestedGroup);
		dispatch('openProjectGroup', { codeBlock: nestedGroup });
		expect(state.viewport).toMatchObject({ x: 512, y: -640 });
		dispatch('goToParentProjectGroup');
		expect(state.viewport).toMatchObject({ x: 128, y: 256 });
	});

	it('uses the home block on the first visit to a group', () => {
		const homeBlock = createMockCodeBlock({
			isHome: true,
			homeAlignment: 'left',
			x: 1000,
			y: 1000,
			width: 80,
			height: 80,
		});
		const group = createMockCodeBlock({ name: 'Audio', childProject: { entries: [], path: '', blocks: [homeBlock] } });
		const { state, dispatch } = setupNavigation([group]);

		dispatch('openProjectGroup', { codeBlock: group });

		expect(state.viewport).toMatchObject({ x: 840, y: 736 });
	});

	it('leaves the viewport and selection unchanged when already at the root', () => {
		const block = createMockCodeBlock();
		const { state, events, dispatch } = setupNavigation([block]);
		state.codeBlockRendering.selectedCodeBlock = block;

		dispatch('goToRootProjectGroup');
		dispatch('goToParentProjectGroup');

		expect(state.viewport).toMatchObject({ x: 64, y: -96 });
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
		expect(events.dispatch).not.toHaveBeenCalled();
	});

	it('cancels an active viewport animation before switching groups', () => {
		const group = createMockCodeBlock({ name: 'Audio', childProject: { entries: [], path: '', blocks: [] } });
		const { state, events, dispatch } = setupNavigation([group]);
		state.callbacks.requestAnimationFrame = vi.fn(() => 7);
		state.callbacks.cancelAnimationFrame = vi.fn();
		animateViewport(state, 1000, 1000, events);

		dispatch('openProjectGroup', { codeBlock: group });

		expect(state.callbacks.cancelAnimationFrame).toHaveBeenCalledWith(7);
		expect(state.viewportAnimation.active).toBe(false);
		expect(state.viewport).toMatchObject({ x: 0, y: 0 });
		dispatch('goToParentProjectGroup');
		expect(state.viewport).toMatchObject({ x: 64, y: -96 });
	});

	it('opens a project group by pointing the rendered slice at its nested blocks', () => {
		const nestedProjectCodeBlocks = [createMockCodeBlock({ name: 'nested' })];
		const groupBlock = createMockCodeBlock({
			childProject: { entries: [], path: '', blocks: nestedProjectCodeBlocks },
		});
		const rootCodeBlocks = [groupBlock];
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: rootCodeBlocks },
				currentProject: { entries: [], path: '', blocks: rootCodeBlocks },
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

		expect(state.codeBlockRendering.rootProject.blocks).toBe(rootCodeBlocks);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(nestedProjectCodeBlocks);
		expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBeUndefined();
		expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(state.viewport.x).toBe(0);
		expect(state.viewport.y).toBe(0);
	});

	it('opens empty project groups', () => {
		const nestedProjectCodeBlocks: [] = [];
		const groupBlock = createMockCodeBlock({
			childProject: { entries: [], path: '', blocks: nestedProjectCodeBlocks },
		});
		const state = createMockState();
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const openGroup = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'openProjectGroup'
		)?.[1];
		openGroup({ codeBlock: groupBlock });

		expect(state.codeBlockRendering.currentProject.blocks).toBe(nestedProjectCodeBlocks);
	});

	it('returns to the immediate parent slice one level at a time', () => {
		const deepestSlice = [createMockCodeBlock({ name: 'deepest' })];
		const nestedGroup = createMockCodeBlock({ childProject: { entries: [], path: '', blocks: deepestSlice } });
		const firstLevelSlice = [nestedGroup];
		const rootGroup = createMockCodeBlock({ childProject: { entries: [], path: '', blocks: firstLevelSlice } });
		const rootCodeBlocks = [rootGroup];
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: rootCodeBlocks },
				currentProject: { entries: [], path: '', blocks: deepestSlice },
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const goBack = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'goToParentProjectGroup'
		)?.[1];
		goBack();

		expect(state.codeBlockRendering.currentProject.blocks).toBe(firstLevelSlice);

		goBack();

		expect(state.codeBlockRendering.currentProject.blocks).toBe(rootCodeBlocks);
	});

	it('keeps the root slice active when there is no parent', () => {
		const state = createMockState();
		const rootCodeBlocks = state.codeBlockRendering.rootProject.blocks;
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const goBack = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'goToParentProjectGroup'
		)?.[1];
		goBack();

		expect(state.codeBlockRendering.currentProject.blocks).toBe(rootCodeBlocks);
	});

	it('ignores ordinary code blocks when opening a group', () => {
		const state = createMockState();
		const originalSlice = state.codeBlockRendering.currentProject.blocks;
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		projectGroupNavigation(store, events);
		const openGroup = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'openProjectGroup'
		)?.[1];
		openGroup({ codeBlock: createMockCodeBlock() });

		expect(state.codeBlockRendering.currentProject.blocks).toBe(originalSlice);
	});
});
