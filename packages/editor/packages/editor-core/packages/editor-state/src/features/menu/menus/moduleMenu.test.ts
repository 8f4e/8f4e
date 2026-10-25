import type { PianoKeyboard } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { moduleMenu } from './moduleMenu';

describe('module menu', () => {
	it('places contributed items after enable/disable and before the remaining block actions', () => {
		const codeBlock = createMockCodeBlock({ blockType: 'module', code: ['module test', 'moduleEnd'] });
		const state = createMockState({ codeBlockRendering: { selectedCodeBlock: codeBlock } });
		const item = { title: 'Custom block action', action: 'customAction' };
		const items = moduleMenu(state, { items: [item] });
		expect(items.indexOf(item)).toBe(items.findIndex(item => item.action === 'toggleCodeBlockDisabled') + 1);
		expect(items.indexOf(item)).toBeLessThan(items.findIndex(item => item.action === 'toggleFavoriteDirective'));
	});

	it('allows contributed actions in view mode', () => {
		const state = createMockState({ featureFlags: { editing: false } });
		const item = { title: 'Read-only custom action', action: 'inspect' };
		expect(moduleMenu(state, { items: [item] })).toContain(item);
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

		const items = await moduleMenu(state);

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

		const items = await moduleMenu(state);

		expect(items.some(candidate => candidate.action === 'openProjectGroup')).toBe(false);
	});

	it('adds a go-back action when rendering a nested project slice', async () => {
		const rootCodeBlocks = [createMockCodeBlock()];
		const nestedProjectCodeBlocks = [createMockCodeBlock()];
		const state = createMockState({
			codeBlockRendering: {
				rootCodeBlocks,
				codeBlocks: nestedProjectCodeBlocks,
				selectedCodeBlock: nestedProjectCodeBlocks[0],
			},
		});

		const items = await moduleMenu(state);

		expect(items.find(candidate => candidate.action === 'goToParentProjectGroup')).toEqual({
			title: 'Go back',
			action: 'goToParentProjectGroup',
			close: true,
		});
	});

	it('adds an action for saving slider values to code when a selected block has sliders', async () => {
		const codeBlock = createMockCodeBlock({
			blockType: 'module',
			code: ['module synth', 'float gain 0.5', '; @slider &gain', 'moduleEnd'],
		});
		codeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'gain',
				allocationUnitAddress: 4,
				byteAddress: 16,
				isInteger: false,
				x: 0,
				y: 0,
				width: 100,
				height: 20,
				min: 0,
				max: 1,
			},
		];
		const state = createMockState({
			callbacks: {
				getWordFromMemory: () => 0.75,
			},
			codeBlockRendering: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await moduleMenu(state);
		const item = items.find(candidate => candidate.action === 'saveSliderValuesToCode');

		expect(item).toEqual(
			expect.objectContaining({
				title: 'Save slider and piano values to code',
				payload: { codeBlock },
				close: true,
				disabled: false,
			})
		);
	});

	it('disables the slider save action when runtime memory cannot be read', async () => {
		const codeBlock = createMockCodeBlock({ blockType: 'module' });
		codeBlock.widgets.sliders = [
			{
				moduleId: 'test-block',
				id: 'gain',
				allocationUnitAddress: 4,
				byteAddress: 16,
				isInteger: false,
				x: 0,
				y: 0,
				width: 100,
				height: 20,
				min: 0,
				max: 1,
			},
		];
		const state = createMockState({
			codeBlockRendering: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await moduleMenu(state);
		const item = items.find(candidate => candidate.action === 'saveSliderValuesToCode');

		expect(item).toEqual(expect.objectContaining({ disabled: true }));
	});

	it.each([true, false])(
		'enables the shared save action for piano-only modules when memory is readable: %s',
		async readable => {
			const codeBlock = createMockCodeBlock({ blockType: 'module' });
			codeBlock.widgets.pianoKeyboards = [{} as PianoKeyboard];
			const state = createMockState({
				callbacks: { getWordFromMemory: readable ? () => 0 : undefined },
				codeBlockRendering: { selectedCodeBlock: codeBlock },
			});
			const items = await moduleMenu(state);
			expect(items.find(item => item.action === 'saveSliderValuesToCode')).toEqual(
				expect.objectContaining({
					title: 'Save slider and piano values to code',
					disabled: !readable,
				})
			);
		}
	);

	it('adds an action for removing intermodular memory connections', async () => {
		const codeBlock = createMockCodeBlock({
			blockType: 'module',
			code: ['module synth', 'float foo &module:bar', 'moduleEnd'],
		});
		const state = createMockState({
			codeBlockRendering: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await moduleMenu(state);
		const item = items.find(candidate => candidate.action === 'removeConnections');

		expect(item).toEqual(
			expect.objectContaining({
				title: 'Remove connections',
				payload: { codeBlock },
				close: true,
				disabled: false,
			})
		);
	});

	it('adds an align blocks in row action for grouped blocks', async () => {
		const codeBlock = createMockCodeBlock({
			code: ['module synth', '; @group myGroup', 'moduleEnd'],
			blockType: 'module',
		});
		codeBlock.groupName = 'myGroup';
		const state = createMockState({
			codeBlockRendering: {
				codeBlocks: [codeBlock],
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await moduleMenu(state);

		expect(items.find(candidate => candidate.action === 'alignGroupBlocksInRow')).toEqual({
			title: 'Align blocks in row',
			action: 'alignGroupBlocksInRow',
			payload: { codeBlock },
			close: true,
		});
	});

	it('does not add the align blocks in row action to ungrouped blocks', async () => {
		const codeBlock = createMockCodeBlock();
		const state = createMockState({
			codeBlockRendering: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await moduleMenu(state);

		expect(items.some(candidate => candidate.action === 'alignGroupBlocksInRow')).toBe(false);
	});

	it('disables the remove connections action when only local memory references exist', async () => {
		const codeBlock = createMockCodeBlock({
			blockType: 'module',
			code: ['module synth', 'float bar &bar', 'moduleEnd'],
		});
		const state = createMockState({
			codeBlockRendering: {
				selectedCodeBlock: codeBlock,
			},
		});

		const items = await moduleMenu(state);
		const item = items.find(candidate => candidate.action === 'removeConnections');

		expect(item).toEqual(expect.objectContaining({ disabled: true }));
	});
});
