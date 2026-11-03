import { resolvePalette } from '@8f4e/editor-palette';
import loadFontAtlas from '@8f4e/sprite-generator';
import init from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockStateWithColors from './utils/createMockStateWithColors';
import generateContextMenuMock from './utils/generateContextMenuMock';

test('context menu', async () => {
	const canvas = createCanvas();
	const mockState = await createMockStateWithColors();
	const memoryViews = createMockMemoryViews();
	const spriteData = await loadFontAtlas(mockState.editorConfig.font);

	const renderer = await init(mockState, canvas, memoryViews, spriteData, resolvePalette(mockState.editorConfig.color));
	try {
		renderer.pauseRendering();
		mockState.contextMenu = generateContextMenuMock();
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
	}
});
