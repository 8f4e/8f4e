import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import init from '@8f4e/web-ui';
import type { CodeBlockRenderData, WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockSpriteData from './utils/createMockSpriteData';
import createMockStateWithColors from './utils/createMockStateWithColors';
import { resolveCodeWithOneColor } from './utils/generateColorMapMock';

test('font color rendering', async () => {
	const canvas = createCanvas();
	const mockState = await createMockStateWithColors();
	const memoryViews = createMockMemoryViews();
	const spriteData = await createMockSpriteData(mockState);
	const codeBlocks = new Map<number, CodeBlockRenderData>();
	const renderData: WebUiRenderDataSource = { getSnapshot: () => ({ codeBlocks }) };

	await init(mockState, renderData, canvas, memoryViews, spriteData);

	const allCharacters = Array.from({ length: 128 }, (_, i) => String.fromCharCode(i));

	// split into 16 characters per line
	const lines = allCharacters.reduce<string[][]>((acc, char, index) => {
		if (index % 16 === 0) {
			acc.push([] as string[]);
		}
		acc[acc.length - 1].push(char);
		return acc;
	}, []);

	const colors = [
		'fontPrimaryBase',
		'fontInkMuted',
		'fontPrimaryBase',
		'fontInkBase',
		'fontInkMuted',
		'fontPrimaryBase',
		'fontSecondaryBase',
		'fontNegativeOn',
		'fontInkBase',
		'fontPrimaryBase',
		'fontPrimaryBase',
		'fontInkMuted',
		'fontInkBase',
		'fontPrimaryOn',
		'fontSecondaryBase',
		'fontDarkOverlaySoft',
		'fontPrimaryOverlay',
		'fontDarkBase',
		'fontInverseAccent',
	];

	colors.forEach((colorName, index) => {
		if (!mockState.spriteLookups?.[colorName]) {
			return;
		}

		const color = mockState.spriteLookups[colorName];
		const codeLines = ['', colorName, ...lines.map(line => line.join('')), ''];
		const codeToRender = resolveCodeWithOneColor(codeLines, color);

		const block = createMockCodeBlock({
			creationIndex: index,
			x: (index % 4) * 8 * 32,
			y: 16 * 12 * Math.floor(index / 4),
			width: 256,
			height: codeLines.length * 16,
		});
		mockState.codeBlockRendering.codeBlocks.push(block);
		codeBlocks.set(block.creationIndex, { codeCells: codeToRender });
	});

	await expect(canvas).toMatchScreenshot();
});
