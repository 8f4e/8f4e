import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import init from '@8f4e/web-ui';
import type { CodeBlockRenderData, WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockSpriteData from './utils/createMockSpriteData';
import createMockStateWithColors from './utils/createMockStateWithColors';
import resolveFixtureCodeCells from './utils/resolveFixtureCodeCells';

test('dragged module', async () => {
	const canvas = createCanvas();
	const mockState = await createMockStateWithColors();
	const memoryViews = createMockMemoryViews();
	const spriteData = await createMockSpriteData(mockState);
	const codeBlocks = new Map<number, CodeBlockRenderData>();
	const renderData: WebUiRenderDataSource = { getSnapshot: () => ({ codeBlocks }) };

	const renderer = await init(mockState, renderData, canvas, memoryViews, spriteData);

	try {
		renderer.pauseRendering();
		expect(mockState.spriteLookups).toBeDefined();
		const lookups = mockState.spriteLookups!;
		const codeLines = [
			'',
			'lorem ipsum dolor sit amet',
			'consectetur adipiscing elit',
			'sed do eiusmod tempor',
			'ut enim ad minim veniam',
			'quis nostrud exercitation',
			'',
		];
		const codeToRender = resolveFixtureCodeCells(codeLines, lookups.font);

		const codeBlockMock = createMockCodeBlock({
			x: 16,
			y: 16,
			width: 256,
			height: codeLines.length * 16,
		});

		mockState.codeBlockRendering.draggedCodeBlock = codeBlockMock;

		mockState.codeBlockRendering.codeBlocks.push(codeBlockMock);
		codeBlocks.set(codeBlockMock.creationIndex, { codeCells: codeToRender });
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
	}
});
