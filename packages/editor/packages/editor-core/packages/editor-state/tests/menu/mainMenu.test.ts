import { describe, expect, it } from 'vitest';
import { mainMenu } from '../../src/features/menu/menus';
import { createMockState } from '../../src/pureHelpers/testingUtils/testUtils';

describe('menus - go home entry', () => {
	it('adds a go-back action when rendering a nested project slice', () => {
		const rootCodeBlocks = [];
		const nestedProjectCodeBlocks = [];
		const mockState = createMockState({
			codeBlockRendering: {
				rootProject: { path: '', blocks: rootCodeBlocks },
				currentProject: { path: '', blocks: nestedProjectCodeBlocks },
			},
		});

		const menu = mainMenu(mockState);

		expect(menu.find(item => item.action === 'goToParentProjectGroup')).toEqual({
			title: 'Go back',
			action: 'goToParentProjectGroup',
			close: true,
		});
	});

	it('does not add a go-back action at the project root', () => {
		const mockState = createMockState();

		const menu = mainMenu(mockState);

		expect(menu.some(item => item.action === 'goToParentProjectGroup')).toBe(false);
	});

	it('shows "Go @home" even when no home block exists', () => {
		const mockState = createMockState({
			editorMode: 'edit',
			codeBlockRendering: { currentProject: { path: '', blocks: [] } },
		});

		const menu = mainMenu(mockState);

		const goHomeItem = menu.find(item => item.title === 'Go @home');

		expect(goHomeItem).toEqual({ title: 'Go @home', action: 'goHome', close: true });
	});

	it('shows "New Note" when editing is enabled', () => {
		const mockState = createMockState({
			editorMode: 'edit',
		});

		const menu = mainMenu(mockState);
		const newNoteItem = menu.find(item => item.title === 'New Note');

		expect(newNoteItem).toBeDefined();
		expect(newNoteItem?.action).toBe('createCodeBlock');
		expect(newNoteItem?.payload).toEqual({ blockType: 'note' });
	});

	it('shows "New Prototype" when editing is enabled', () => {
		const mockState = createMockState({
			editorMode: 'edit',
		});

		const menu = mainMenu(mockState);
		const newPrototypeItem = menu.find(item => item.title === 'New Prototype');

		expect(newPrototypeItem).toBeDefined();
		expect(newPrototypeItem?.action).toBe('createCodeBlock');
		expect(newPrototypeItem?.payload).toEqual({ blockType: 'prototype' });
	});

	it('uses "New Module" as the module creation action', () => {
		const mockState = createMockState({
			editorMode: 'edit',
		});

		const menu = mainMenu(mockState);
		const newModuleItem = menu.find(item => item.title === 'New Module');

		expect(newModuleItem).toBeDefined();
		expect(newModuleItem?.action).toBe('createCodeBlock');
		expect(newModuleItem?.payload).toEqual({ blockType: 'module' });
	});

	it('hides "New Module" when editing is disabled', () => {
		const mockState = createMockState({
			editorMode: 'view',
		});

		const menu = mainMenu(mockState);
		const newModuleItem = menu.find(item => item.title === 'New Module');

		expect(newModuleItem).toBeUndefined();
	});
});
