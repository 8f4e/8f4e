import { describe, expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '../../src/__tests__/helpers/mockEditorState';
import { mainMenu } from '../../src/ui-state/menu/menus/index';

describe('menus - main menu', () => {
	it('adds a go-back action when a child level is active', () => {
		const childLevel = { entries: [], path: '', blocks: [] };
		const rootLevel = { entries: [], path: '', blocks: [createMockCodeBlock({ childLevel })] };
		const mockState = createMockState({
			project: {
				rootLevel,
				activeLevel: childLevel,
			},
		});

		const menu = mainMenu(mockState, []);

		expect(menu.find(item => item.action === 'goToParentProjectGroup')).toEqual({
			title: 'Go back',
			action: 'goToParentProjectGroup',
			close: true,
		});
	});

	it('does not add a go-back action at the project root', () => {
		const mockState = createMockState();

		const menu = mainMenu(mockState, []);

		expect(menu.some(item => item.action === 'goToParentProjectGroup')).toBe(false);
	});

	it('has no built-in actions at the project root in edit mode', () => {
		const mockState = createMockState({
			editorMode: 'edit',
			project: { activeLevel: { entries: [], path: '', blocks: [] } },
		});

		const menu = mainMenu(mockState, []);

		expect(menu).toEqual([]);
	});
});
