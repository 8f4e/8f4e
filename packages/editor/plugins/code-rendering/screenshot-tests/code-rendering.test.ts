import initEditor from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { expect, test } from 'vitest';
import { codeRenderingPlugin } from '../src/index';

test('renders code, notes, tabs, disabled blocks, folds, and contributed gaps', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 960;
	canvas.height = 480;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		plugins: [
			codeRenderingPlugin,
			{
				id: 'fixture-layout',
				setup: ({ layout }) => {
					const contribution = layout.createContribution();
					const unsubscribe = layout.subscribe(({ codeBlock }) => {
						if (codeBlock.name === 'syntax')
							contribution.update(codeBlock, {
								verticalSpaceAfterSourceLine: [{ sourceLineIndex: 5, heightInRows: 2 }],
							});
					});
					return () => {
						unsubscribe();
						contribution.dispose();
					};
				},
			},
		],
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 4, code: ['constants env', '; @pos 120 100', 'constantsEnd'] }],
			execution: [
				{
					type: 'module',
					entry: 'main',
					id: 0,
					code: [
						'module syntax',
						'; @pos 4 3',
						'; @tab 8 16',
						'int\tvalue\t42',
						'push 0b1010 ; binary bits',
						'push 0xff',
						'add',
						'drop',
						'moduleEnd',
					],
				},
				{
					type: 'module',
					entry: 'main',
					id: 1,
					code: ['module disabled', '; @pos 52 3', '; @disabled', 'push 1', 'drop', 'moduleEnd'],
				},
				{
					type: 'module',
					entry: 'main',
					id: 2,
					code: ['module folded', '; @pos 52 13', '; @hide', 'push 123', 'drop', 'moduleEnd'],
				},
			],
			notes: [
				{
					id: 3,
					code: ['note explanation', '; @pos 4 18', '# Code rendering', 'Text and *emphasis* with 123.', 'noteEnd'],
				},
			],
		},
	});
	editor.pauseRendering();
	try {
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
