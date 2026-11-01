import { describe, expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { moduleMenu } from './moduleMenu';

describe('module menu', () => {
	it('places contributed items after enable/disable and before the remaining block actions', () => {
		const codeBlock = createMockCodeBlock({ blockType: 'module', code: ['module test', 'moduleEnd'] });
		const state = createMockState({ codeBlockRendering: { selectedCodeBlock: codeBlock } });
		const item = { title: 'Custom block action', action: 'customAction' };
		const items = moduleMenu(state, codeBlock, [item]);
		expect(items.indexOf(item)).toBe(items.findIndex(item => item.action === 'toggleCodeBlockDisabled') + 1);
		expect(items.indexOf(item)).toBeLessThan(items.findIndex(item => item.action === 'copyCodeBlock'));
	});

	it('allows contributed actions in view mode', () => {
		const codeBlock = createMockCodeBlock();
		const state = createMockState({ editorMode: 'view' });
		const item = { title: 'Read-only custom action', action: 'inspect' };
		expect(moduleMenu(state, codeBlock, [item])).toContain(item);
	});

	it('adds an open action for project-group blocks', async () => {
		const codeBlock = createMockCodeBlock({
			name: 'Audio',
			nestedProjectCodeBlocks: [],
		});
		const state = createMockState({
			codeBlockRendering: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await moduleMenu(state, codeBlock, []);

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
			codeBlockRendering: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await moduleMenu(state, codeBlock, []);

		expect(items.some(candidate => candidate.action === 'openProjectGroup')).toBe(false);
	});

	it('adds a go-back action when rendering a nested project slice', async () => {
		const rootCodeBlocks = [createMockCodeBlock()];
		const nestedProjectCodeBlocks = [createMockCodeBlock()];
		const codeBlock = nestedProjectCodeBlocks[0];
		const state = createMockState({
			codeBlockRendering: {
				rootCodeBlocks,
				codeBlocks: nestedProjectCodeBlocks,
				selectedCodeBlock: nestedProjectCodeBlocks[0],
			},
		});

		const items = await moduleMenu(state, codeBlock, []);

		expect(items.find(candidate => candidate.action === 'goToParentProjectGroup')).toEqual({
			title: 'Go back',
			action: 'goToParentProjectGroup',
			close: true,
		});
	});
});
