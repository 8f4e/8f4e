import { describe, expect, it } from 'vitest';
import { mainMenu } from '../../src/features/menu/menus';
import { createMockState } from '../../src/pureHelpers/testingUtils/testUtils';

describe('menus - go home entry', () => {
	it('adds a go-back action when rendering a nested project slice', () => {
		const rootCodeBlocks = [];
		const nestedProjectCodeBlocks = [];
		const mockState = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: rootCodeBlocks },
				currentProject: { entries: [], path: '', blocks: nestedProjectCodeBlocks },
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
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: [] } },
		});

		const menu = mainMenu(mockState);

		const goHomeItem = menu.find(item => item.title === 'Go @home');

		expect(goHomeItem).toEqual({ title: 'Go @home', action: 'goHome', close: true });
	});
});
