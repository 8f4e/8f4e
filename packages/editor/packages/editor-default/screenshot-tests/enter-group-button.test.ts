import { parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { createDefaultEditorPlugins } from '@8f4e/editor-default';
import type {} from '@vitest/browser-playwright';
import { Engine } from 'glugglugglug';
import { expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';

const source = `8f4e/v1
constants env
; @pos 120 60
constantsEnd
entry main
group audio
; @pos 4 3
entry main
group voices
; @pos 4 3
entry main
module oscillator
; @pos 4 3
int value 0
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
module output
; @pos 45 3
int value 0
moduleEnd
entryEnd`;

const lightSource = source.replace(
	'constantsEnd\n',
	`constantsEnd
note colors
; @pos 120 65
; @config color.canvas #dcd9d0
; @config color.surface #f4f0e7
; @config color.ink #3e4a4b
; @config color.muted #9a9d99
; @config color.primary #159897
; @config color.secondary #c66559
; @config color.positive #8ab69a
; @config color.warning #d8aa4d
; @config color.negative #d66a66
; @config color.stroke rgba(21,143,143,0.5)
; @config color.tertiary #7b8580
; @config color.highlight #ed6176
; @config color.detail #35aaa5
noteEnd
`
);

test.each([
	{ touch: false, light: false },
	{ touch: true, light: false },
	{ touch: false, light: true },
])('opens centered project group buttons with native input (touch=$touch, light=$light)', async ({ touch, light }) => {
	const input = cdp();
	if (touch) await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	const canvas = document.createElement('canvas');
	canvas.width = 720;
	canvas.height = 320;
	canvas.style.outline = 'none';
	document.body.append(canvas);
	let editor: Editor | undefined;
	let context!: EditorPluginContext;
	try {
		const plugins = createDefaultEditorPlugins({
			canvas,
			storage: { getItem: () => null, setItem: () => {} } as Storage,
			storageKey: 'enter-group-button-test',
			renderFrame: () => editor!.renderFrame(),
			getMemory: () => null,
			writeMemory: () => {},
			getCodeBuffer: () => new Uint8Array(),
			getAssertionSites: () => undefined,
		});
		const instance = await initEditor(canvas, {
			renderer: new Engine(canvas),
			initialProject: parseProjectSource(light ? lightSource : source),
			plugins: [
				...plugins,
				{
					id: 'test-context',
					setup: services => {
						context = services;
						return () => {};
					},
				},
			],
		});
		editor = instance;
		instance.pauseRendering();
		await vi.dynamicImportSettled();
		const state = instance.state;
		if (light) expect(state.editorConfig.color).toMatchObject({ surface: '#f4f0e7', ink: '#3e4a4b' });
		const root = state.project.activeLevel;
		const group = root.blocks.find(block => block.name === 'audio')!;
		await expect.poll(() => group.gaps.get(0)?.size).toBe(2);
		const revision = state.projectChange.revision;
		state.viewport.x = 0;
		state.viewport.y = 0;
		context.store.set('loadingIndicators', []);
		instance.renderFrame();
		if (!touch) await expect(canvas).toMatchScreenshot(light ? 'enter-group-button-light' : 'enter-group-button');

		const clickButton = async (name: string) => {
			const block = state.project.activeLevel.blocks.find(block => block.name === name)!;
			const rect = canvas.getBoundingClientRect();
			const frame = window.frameElement!.getBoundingClientRect();
			const point = {
				x: frame.left + rect.left + block.x - state.viewport.x + block.width / 2,
				y: frame.top + rect.top + block.y - state.viewport.y + 1.5 * state.viewport.hGrid,
			};
			if (touch) {
				await input.send('Input.dispatchTouchEvent', {
					type: 'touchStart',
					touchPoints: [{ ...point, id: 1 }],
				});
				await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			} else {
				const parent = state.project.activeLevel;
				await input.send('Input.dispatchMouseEvent', {
					type: 'mousePressed',
					...point,
					button: 'left',
					buttons: 1,
					clickCount: 1,
				});
				try {
					expect(state.project.activeLevel).toBe(parent);
					if (name === 'audio') {
						instance.renderFrame();
						await expect(canvas).toMatchScreenshot(
							light ? 'enter-group-button-pressed-light' : 'enter-group-button-pressed'
						);
					}
				} finally {
					await input.send('Input.dispatchMouseEvent', {
						type: 'mouseReleased',
						...point,
						button: 'left',
						buttons: 0,
						clickCount: 1,
					});
				}
			}
			await expect.poll(() => state.project.activeLevel).toBe(block.childLevel);
		};
		await clickButton('audio');
		await clickButton('voices');
		expect(state.project.activeLevel.blocks.some(block => block.name === 'oscillator')).toBe(true);
		expect(state.projectChange.revision).toBe(revision);
		expect(state.project.draggedCodeBlock).toBeUndefined();
		instance.navigation.goToRoot();
		expect(state.project.activeLevel).toBe(root);
	} finally {
		editor?.dispose();
		canvas.remove();
		if (touch) await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});
