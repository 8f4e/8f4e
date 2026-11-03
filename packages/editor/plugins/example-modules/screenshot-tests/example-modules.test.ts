import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EventDispatcher } from '@8f4e/editor-core';
import { expect, test, vi } from 'vitest';
import { createExampleModulesPlugin } from '../src/index';

test('browses nested categories on canvas, navigates Back, and inserts public blocks with dependencies', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 640;
	canvas.style.width = '1024px';
	canvas.style.height = '640px';
	document.body.appendChild(canvas);
	const source = '8f4e/v1\nconstants env\n; @pos 160 100\nconstantsEnd';
	const sources = new Map([
		[
			'audio/effects/gain',
			async () => `8f4e/v1
entry main
module gain
; @public
use scales
use shape
float out 0
moduleEnd
entryEnd`,
		],
		[
			'constants/scales',
			async () => `8f4e/v1
constants scales
; @public
const UNITY 1.0
constantsEnd`,
		],
		[
			'functions/math/shape',
			async () => `8f4e/v1
function shape
; @public
param float value
push value
functionEnd float`,
		],
	]);
	let editor: Editor | undefined;
	let events!: EventDispatcher;
	const featurePlugin = createExampleModulesPlugin({ sources });
	try {
		editor = await initEditor(canvas, {
			initialProject: parseProjectSource(source),
			plugins: [
				{
					...featurePlugin,
					setup: context => {
						events = context.events;
						return featurePlugin.setup(context);
					},
				},
			],
		});
		editor.state.editorMode = 'edit';
		const state = editor.state;
		await vi.waitFor(() =>
			expect(state.codeBlockRendering.currentProject.blocks.some(block => block.name === 'env')).toBe(true)
		);
		editor.pauseRendering();
		const mouse = (type: string, x: number, y: number) => {
			events.dispatch(type, {
				x,
				y,
				movementX: 0,
				movementY: 0,
				altKey: false,
				buttons: type === 'mouseup' ? 0 : 1,
				stopPropagation: false,
				canvasWidth: canvas.width,
				canvasHeight: canvas.height,
			});
		};
		const click = async (title: string) => {
			await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.title?.includes(title))).toBe(true));
			const menu = state.contextMenu;
			const index = menu.items.findIndex(item => item.title?.includes(title));
			const x = menu.x - state.viewport.x + 8;
			const y = menu.y - state.viewport.y + index * state.viewport.hGrid + 8;
			mouse('mousemove', x, y);
			mouse('mousedown', x, y);
		};
		mouse('contextmenu', 80, 32);
		await click('Add Built-in Block');
		await click('Audio');
		await click('Effects');
		await click('< Back');
		await click('Effects');
		await click('< Back');
		await click('< Back');
		await click('Audio');
		await click('Effects');
		await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.title?.includes('Gain'))).toBe(true));
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('example-modules-categories');
		await click('Gain');
		await vi.waitFor(() =>
			expect(state.codeBlockRendering.currentProject.blocks.map(block => block.name)).toEqual([
				'env',
				'gain',
				'scales',
				'shape',
			])
		);
		expect(state.contextMenu.open).toBe(false);
		for (const block of state.codeBlockRendering.currentProject.blocks) expect(block.code).not.toContain('; @public');
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('example-modules-inserted');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
