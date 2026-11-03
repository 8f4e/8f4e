import initEditor, { type EditorPluginContext } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { EMPTY_DEFAULT_PROJECT, jumpToCodeBlock } from '@8f4e/editor-state';
import { expect, test, vi } from 'vitest';

test('draws blocks entering the viewport during navigation and culls blocks leaving it', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 320;
	canvas.height = 192;
	canvas.style.cssText = 'width:320px;height:192px;image-rendering:pixelated';
	document.body.append(canvas);
	let context!: EditorPluginContext;
	const visible: string[] = [];
	const editor = await initEditor(canvas, {
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants env', '; @pos 300 100', 'constantsEnd'] }],
			notes: [
				{ id: 1, code: ['note start', '; @pos 4 4', 'noteEnd'] },
				{ id: 2, code: ['note middle', '; @pos 80 4', 'noteEnd'] },
				{ id: 3, code: ['note destination', '; @pos 142 6', 'noteEnd'] },
			],
		},
		featureFlags: { offscreenBlockArrows: false },
		plugins: [
			{
				id: 'visible-blocks',
				setup: services => {
					context = services;
					return services.drawers.registerCodeBlockContentDrawer(({ draw, codeBlock }) => {
						visible.push(codeBlock.name);
						draw.drawText(8, 16, codeBlock.name, PALETTE_INDICES.inkBase);
					});
				},
			},
		],
	});
	editor.pauseRendering();
	const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
	try {
		const state = editor.state;
		const destination = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'destination')!;
		jumpToCodeBlock(context.store, destination.creationIndex);
		const { targetX, targetY } = state.viewportAnimation;
		visible.length = 0;
		editor.renderFrame();
		expect(visible).toEqual(['start']);
		expect(state.viewport).toMatchObject({ x: 0, y: 0 });

		now.mockReturnValue(1250);
		visible.length = 0;
		editor.renderFrame();
		expect(state.viewportAnimation.active).toBe(true);
		expect(state.viewport).toMatchObject({ x: Math.round(targetX / 2), y: Math.round(targetY / 2) });
		expect(visible).toEqual(['middle']);
		await expect(canvas).toMatchScreenshot('mid-navigation');

		now.mockReturnValue(1500);
		visible.length = 0;
		editor.renderFrame();
		expect(state.viewportAnimation.active).toBe(false);
		expect(state.viewport).toMatchObject({ x: targetX, y: targetY });
		expect(visible).toEqual(['destination']);
	} finally {
		now.mockRestore();
		editor.dispose();
		canvas.remove();
	}
});
