import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { jumpToCodeBlock } from '@8f4e/editor-state';
import { createMockCodeBlock, createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import init, { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { expect, test, vi } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';

test('draws blocks entering the viewport during navigation and culls blocks leaving it', async () => {
	const canvas = createCanvas();
	canvas.width = 320;
	canvas.height = 192;
	const blocks = [
		createMockCodeBlock({ name: 'start', creationIndex: 0, x: 32, y: 64, width: 96, height: 96 }),
		createMockCodeBlock({ name: 'middle', creationIndex: 1, x: 640, y: 64, width: 96, height: 96 }),
		createMockCodeBlock({
			name: 'destination',
			creationIndex: 2,
			x: 1136,
			y: 96,
			width: 96,
			height: 96,
			cursor: { row: 0, col: 0, x: 0, y: 0 },
		}),
	];
	const state = createMockState({
		viewport: { width: 320, height: 192, roundedWidth: 320, roundedHeight: 192 },
		featureFlags: { offscreenBlockArrows: false },
		codeBlockRendering: { currentProject: { path: '', entries: [], blocks } },
	});
	const store = createStateManager(state);
	const events = createMockEventDispatcher();
	const drawers = createEditorDrawerRegistry();
	const visible: string[] = [];
	drawers.registerCodeBlockContentDrawer(({ draw, codeBlock }) => {
		visible.push(codeBlock.name);
		draw.drawText(8, 16, codeBlock.name, PALETTE_INDICES.inkBase);
	});
	const renderer = await init(store, events, canvas, createMockMemoryViews(), { drawers });
	renderer.pauseRendering();
	const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
	try {
		jumpToCodeBlock(store, 2);
		visible.length = 0;
		renderer.renderFrame();
		expect(visible).toEqual(['start']);
		expect(state.viewport).toMatchObject({ x: 0, y: 0 });

		now.mockReturnValue(1250);
		visible.length = 0;
		renderer.renderFrame();
		expect(state.viewportAnimation.active).toBe(true);
		expect(state.viewport).toMatchObject({ x: 512, y: 0 });
		expect(visible).toEqual(['middle']);
		await expect(canvas).toMatchScreenshot('mid-navigation');

		now.mockReturnValue(1500);
		visible.length = 0;
		renderer.renderFrame();
		expect(state.viewportAnimation.active).toBe(false);
		expect(state.viewport).toMatchObject({ x: 1024, y: 0 });
		expect(visible).toEqual(['destination']);
	} finally {
		now.mockRestore();
		renderer.destroy();
		store.dispose();
		canvas.remove();
	}
});
