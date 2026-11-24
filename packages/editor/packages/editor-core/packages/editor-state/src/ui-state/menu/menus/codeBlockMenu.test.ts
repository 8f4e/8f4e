import { describe, expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/__tests__/helpers/mockEditorState';
import { codeBlockMenu } from './codeBlockMenu';

describe('code block menu', () => {
	it('places contributed items after enable/disable and before the remaining block actions', () => {
		const codeBlock = createMockCodeBlock({ blockType: 'module', code: ['module test', 'moduleEnd'] });
		const state = createMockState({ project: { selectedCodeBlock: codeBlock } });
		const item = { title: 'Custom block action', action: 'customAction' };
		const items = codeBlockMenu(state, codeBlock, [item]);
		expect(items.indexOf(item)).toBe(items.findIndex(item => item.action === 'toggleCodeBlockDisabled') + 1);
		expect(items.indexOf(item)).toBeLessThan(items.findIndex(item => item.action === 'consoleLog'));
	});

	it('allows contributed actions in view mode', () => {
		const codeBlock = createMockCodeBlock();
		const state = createMockState({ editorMode: 'view' });
		const item = { title: 'Read-only custom action', action: 'inspect' };
		expect(codeBlockMenu(state, codeBlock, [item])).toContain(item);
	});

	it('offers inspection but not enable/disable for read-only blocks', () => {
		const codeBlock = createMockCodeBlock({ readOnly: true });
		const state = createMockState({ editorMode: 'edit' });
		const items = codeBlockMenu(state, codeBlock, []);
		expect(items.some(candidate => candidate.action === 'toggleCodeBlockDisabled')).toBe(false);
		expect(items.some(candidate => candidate.action === 'consoleLog')).toBe(true);
	});

	it('adds an open action for project-group blocks', async () => {
		const codeBlock = createMockCodeBlock({
			name: 'Audio',
			childLevel: { entries: [], path: '', blocks: [] },
		});
		const state = createMockState({
			project: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await codeBlockMenu(state, codeBlock, []);

		expect(items.find(candidate => candidate.action === 'openProjectGroup')).toEqual({
			title: 'Open group',
			action: 'openProjectGroup',
			payload: { codeBlock },
			close: true,
		});
	});

	it('does not add the project-group action to ordinary blocks', async () => {
		const codeBlock = createMockCodeBlock();
		const state = createMockState({
			project: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await codeBlockMenu(state, codeBlock, []);

		expect(items.some(candidate => candidate.action === 'openProjectGroup')).toBe(false);
	});

	it('adds a go-back action when a child level is active', async () => {
		const codeBlock = createMockCodeBlock();
		const childLevel = { entries: [], path: '', blocks: [codeBlock] };
		const rootLevel = { entries: [], path: '', blocks: [createMockCodeBlock({ childLevel })] };
		const state = createMockState({
			project: {
				rootLevel,
				activeLevel: childLevel,
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await codeBlockMenu(state, codeBlock, []);

		expect(items.find(candidate => candidate.action === 'goToParentProjectGroup')).toEqual({
			title: 'Go back',
			action: 'goToParentProjectGroup',
			close: true,
		});
	});

	it('does not add a go-back action at the project root', () => {
		const codeBlock = createMockCodeBlock();
		const state = createMockState({ project: { rootLevel: { blocks: [codeBlock] } } });
		expect(codeBlockMenu(state, codeBlock, []).some(item => item.action === 'goToParentProjectGroup')).toBe(false);
	});
});
