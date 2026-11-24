import initEditor, { type Editor, type EventDispatcher } from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { Engine } from 'glugglugglug';
import { expect, test, vi } from 'vitest';
import { createExampleModulesPlugin } from '../src/index';

test('navigates contributed categories, supports Back, and inserts public blocks with dependencies through the editor', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 640;
	canvas.style.width = '1024px';
	canvas.style.height = '640px';
	document.body.appendChild(canvas);
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
			renderer: new Engine(canvas),
			initialProject: EMPTY_DEFAULT_PROJECT,
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
		await vi.waitFor(() => expect(state.project.activeLevel.blocks.some(block => block.name === 'env')).toBe(true));
		editor.pauseRendering();
		const pointer = (type: string, x: number, y: number) => {
			events.dispatch(type, {
				x,
				y,
				movementX: 0,
				movementY: 0,
				altKey: false,
				buttons: type === 'pointerup' ? 0 : 1,
				stopPropagation: false,
				canvasWidth: canvas.width,
				canvasHeight: canvas.height,
			});
		};
		const position = { x: 80, y: 240 };
		const click = async (title: string) => {
			await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.title?.includes(title))).toBe(true));
			const menu = state.contextMenu;
			const index = menu.items.findIndex(item => item.title?.includes(title));
			events.dispatch('activateContextMenuItem', { index, ...position });
		};
		pointer('contextmenu', position.x, position.y);
		await click('Add Built-in Block');
		await click('Audio');
		await click('Effects');
		await click('Back');
		await click('Effects');
		await click('Back');
		await click('Back');
		await click('Audio');
		await click('Effects');
		await vi.waitFor(() => expect(state.contextMenu.items.some(item => item.title?.includes('Gain'))).toBe(true));
		await click('Gain');
		await vi.waitFor(() =>
			expect(state.project.activeLevel.blocks.map(block => block.name)).toEqual(['env', 'gain', 'scales', 'shape'])
		);
		expect(state.contextMenu.open).toBe(false);
		for (const block of state.project.activeLevel.blocks) expect(block.code).not.toContain('; @public');
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
