import { resolvePalette } from '@8f4e/editor-palette';
import init from '@8f4e/web-ui';
import type { WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockSpriteData from './utils/createMockSpriteData';
import createMockStateWithColors from './utils/createMockStateWithColors';
import generateContextMenuMock from './utils/generateContextMenuMock';

test('context menu', async () => {
	const canvas = createCanvas();
	const mockState = await createMockStateWithColors();
	const memoryViews = createMockMemoryViews();
	const spriteData = await createMockSpriteData(mockState);

	const renderData: WebUiRenderDataSource = { getSnapshot: () => ({ codeBlocks: new Map() }) };
	const renderer = await init(
		mockState,
		renderData,
		canvas,
		memoryViews,
		spriteData,
		resolvePalette(mockState.editorConfig.color)
	);
	try {
		renderer.pauseRendering();
		mockState.contextMenu = generateContextMenuMock();
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
	}
});
