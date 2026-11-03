import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import init from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createScreenshotState from './utils/createScreenshotState';
import generateContextMenuMock from './utils/generateContextMenuMock';

test('context menu', async () => {
	const canvas = createCanvas();
	const mockState = createScreenshotState();
	const memoryViews = createMockMemoryViews();

	const renderer = await init(createStateManager(mockState), createMockEventDispatcher(), canvas, memoryViews);
	try {
		renderer.pauseRendering();
		mockState.contextMenu = generateContextMenuMock();
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
	}
});
