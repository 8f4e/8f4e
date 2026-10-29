import { resolvePalette } from '@8f4e/editor-palette';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import loadFontAtlas from '@8f4e/sprite-generator';
import init from '@8f4e/web-ui';
import { deriveCodeBlockCodeCells, type WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { expect, test, vi } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockStateWithColors from './utils/createMockStateWithColors';

test.each(['view', 'edit'] as const)('selected outline in %s mode', async editorMode => {
	const canvas = createCanvas();
	canvas.width = 400;
	canvas.height = 240;
	const state = createMockStateWithColors({ editorMode });
	state.editorConfig.font = 'ibmvga8x16';
	state.featureFlags.editing = editorMode === 'edit';
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
	state.codeBlockRendering.codeBlocks = [block];
	state.codeBlockRendering.selectedCodeBlock = block;
	const renderData: WebUiRenderDataSource = {
		getSnapshot: () => ({
			codeBlocks: new Map([[block.creationIndex, { codeCells: deriveCodeBlockCodeCells(block) }]]),
		}),
	};
	const renderer = await init(
		state,
		renderData,
		canvas,
		createMockMemoryViews(),
		await loadFontAtlas(state.editorConfig.font),
		resolvePalette(state.editorConfig.color)
	);
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
