import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor } from '@8f4e/editor-core';
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
	try {
		editor = await initEditor(canvas, {
			initialEditorMode: 'edit',
			initialProject: parseProjectSource(source),
			plugins: [createExampleModulesPlugin({ sources })],
		});
		const state = editor.state;
		await vi.waitFor(() => expect(state.codeBlockRendering.codeBlocks.some(block => block.name === 'env')).toBe(true));
		editor.pauseRendering();
		const click = async (title: string) => {
			await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.title?.includes(title))).toBe(true));
			const menu = state.contextMenu;
			const index = menu.items.findIndex(item => item.title?.includes(title));
			const x = menu.x - state.viewport.x + 8;
			const y = menu.y - state.viewport.y + index * state.viewport.hGrid + 8;
			canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
			canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
		};
		canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 80, clientY: 32, bubbles: true }));
		await click('Add Built-in Module');
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
			expect(state.codeBlockRendering.codeBlocks.map(block => block.name)).toEqual(['env', 'gain', 'scales', 'shape'])
		);
		expect(state.contextMenu.open).toBe(false);
		for (const block of state.codeBlockRendering.codeBlocks) expect(block.code).not.toContain('; @public');
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('example-modules-inserted');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
