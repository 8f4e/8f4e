import { createMockCodeBlock, createMockEventDispatcher } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import init, { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { expect, test, vi } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockStateWithColors from './utils/createMockStateWithColors';
import resolveFixtureCodeCells from './utils/resolveFixtureCodeCells';

test.each(['view', 'edit'] as const)('selected outline in %s mode', async editorMode => {
	const canvas = createCanvas();
	canvas.width = 400;
	canvas.height = 240;
	const state = createMockStateWithColors({ editorMode });
	state.editorConfig.font = 'ibmvga8x16';
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	const block = createMockCodeBlock({
		creationIndex: 0,
		blockType: 'module',
		x: 48,
		y: 48,
		width: 256,
		height: 112,
		code: ['module selected', 'int value 1', '', 'push value', 'drop', 'moduleEnd'],
	});
	state.codeBlockRendering.currentProject.blocks = [block];
	state.codeBlockRendering.selectedCodeBlock = block;
	const drawers = createEditorDrawerRegistry();
	const rows = resolveFixtureCodeCells(block.code);
	drawers.registerCodeBlockContentDrawer(({ draw, state }) => {
		rows.forEach((cells, row) => draw.drawResolvedText(state.viewport.vGrid, row * state.viewport.hGrid, cells));
	});
	const renderer = await init(createStateManager(state), createMockEventDispatcher(), canvas, createMockMemoryViews(), {
		drawers,
	});
	renderer.pauseRendering();
	const now = vi.spyOn(performance, 'now').mockReturnValue(0);
	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot(`selected-outline-${editorMode}-start`);
		now.mockReturnValue(160);
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot(`selected-outline-${editorMode}-advanced`);
	} finally {
		now.mockRestore();
		renderer.destroy();
	}
});
