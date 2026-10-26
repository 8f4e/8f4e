import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import init from '@8f4e/web-ui';
import type { CodeBlockRenderData, WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { expect, test, vi } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockSpriteData from './utils/createMockSpriteData';
import createMockStateWithColors from './utils/createMockStateWithColors';
import { resolveCodeWithOneColor } from './utils/generateColorMapMock';

test('buttons', async () => {
	const canvas = createCanvas();
	const mockState = await createMockStateWithColors({
		editorConfig: {
			color: {
				text: {
					controlKnob: '#ffcc00',
				},
				fill: {
					switchBackground: '#111111',
					controlKnob: '#336699',
				},
			},
		},
	});
	const memoryViews = createMockMemoryViews();
	const spriteData = await createMockSpriteData(mockState);
	const codeBlocks = new Map<number, CodeBlockRenderData>();
	const renderData: WebUiRenderDataSource = { getSnapshot: () => ({ codeBlocks }) };

	const renderer = await init(mockState, renderData, canvas, memoryViews, spriteData);

	const control = {
		width: 32,
		height: 16,
		x: 100,
		y: 100,
		id: 'set',
		allocationUnitAddress: 0,
		isInteger: true,
		offValue: 0,
		onValue: 1,
	};
	memoryViews.int32[1] = 1;

	if (mockState.spriteLookups) {
		const lines1 = ['selected code block', '', '', '', '', '', '', '', ''];
		const codeToRender1 = resolveCodeWithOneColor(lines1, mockState.spriteLookups.fontCode);

		const codeBlockMock = createMockCodeBlock({
			creationIndex: 0,
			x: 16,
			y: 16,
			width: 256,
			height: lines1.length * 16,
		});
		codeBlockMock.widgets.buttons = [control];

		mockState.codeBlockRendering.selectedCodeBlock = codeBlockMock;

		mockState.codeBlockRendering.codeBlocks.push(codeBlockMock);
		codeBlocks.set(codeBlockMock.creationIndex, { codeCells: codeToRender1 });

		const lines2 = ['not selected code block', '', '', '', '', '', '', '', ''];
		const codeToRender2 = resolveCodeWithOneColor(lines2, mockState.spriteLookups.fontCode);

		const otherCodeBlock = createMockCodeBlock({
			creationIndex: 1,
			x: 288,
			y: 16,
			width: 256,
			height: lines2.length * 16,
		});
		otherCodeBlock.widgets.buttons = [{ ...control, allocationUnitAddress: 1 }];
		mockState.codeBlockRendering.codeBlocks.push(otherCodeBlock);
		codeBlocks.set(otherCodeBlock.creationIndex, { codeCells: codeToRender2 });
	}

	renderer.pauseRendering();
	const now = vi.spyOn(performance, 'now').mockReturnValue(0);
	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		now.mockRestore();
		renderer.destroy();
	}
});
