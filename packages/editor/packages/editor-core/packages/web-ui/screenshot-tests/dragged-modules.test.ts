import { resolvePalette } from '@8f4e/editor-palette';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import loadFontAtlas from '@8f4e/sprite-generator';
import init, { createEditorDrawerRegistry, type SpriteCell } from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockStateWithColors from './utils/createMockStateWithColors';
import resolveFixtureCodeCells from './utils/resolveFixtureCodeCells';

test('dragged module', async () => {
	const canvas = createCanvas();
	const mockState = await createMockStateWithColors();
	const memoryViews = createMockMemoryViews();
	const spriteData = await loadFontAtlas(mockState.editorConfig.font);
	const codeBlocks = new Map<number, Array<Array<SpriteCell | null>>>();
	const drawers = createEditorDrawerRegistry();
	drawers.registerCodeBlockContentDrawer(({ draw, state, codeBlock }) => {
		codeBlocks
			.get(codeBlock.creationIndex)!
			.forEach((cells, row) => draw.drawResolvedText(state.viewport.vGrid, row * state.viewport.hGrid, cells));
	});

	const renderer = await init(
		mockState,
		canvas,
		memoryViews,
		spriteData,
		resolvePalette(mockState.editorConfig.color),
		{ drawers }
	);

	try {
		renderer.pauseRendering();

		const codeLines = [
			'',
			'lorem ipsum dolor sit amet',
			'consectetur adipiscing elit',
			'sed do eiusmod tempor',
			'ut enim ad minim veniam',
			'quis nostrud exercitation',
			'',
		];
		const codeToRender = resolveFixtureCodeCells(codeLines);

		const codeBlockMock = createMockCodeBlock({
			x: 16,
			y: 16,
			width: 256,
			height: codeLines.length * 16,
		});

		mockState.codeBlockRendering.draggedCodeBlock = codeBlockMock;

		mockState.codeBlockRendering.currentProject.blocks.push(codeBlockMock);
		codeBlocks.set(codeBlockMock.creationIndex, codeToRender);
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
	}
});
