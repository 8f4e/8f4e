import { PALETTE_INDICES, PALETTE_TOKENS, resolvePalette } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { CP437_CHARACTERS } from '@8f4e/sprite-generator';
import createStateManager from '@8f4e/state-manager';
import init, { createEditorDrawerRegistry, type SpriteCell } from '@8f4e/web-ui';
import { page as browserPage } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createScreenshotState from './utils/createScreenshotState';
import resolveFixtureCodeCells from './utils/resolveFixtureCodeCells';

const FONTS_PER_PAGE = 12;
const SAMPLE_HEIGHT = 320;
const pages = Array.from({ length: Math.ceil(PALETTE_TOKENS.length / FONTS_PER_PAGE) }, (_, index) => ({
	page: index + 1,
	tokens: PALETTE_TOKENS.slice(index * FONTS_PER_PAGE, (index + 1) * FONTS_PER_PAGE),
}));

test.each(pages)('font color rendering page $page', async ({ page, tokens }) => {
	const canvas = createCanvas();
	canvas.height = Math.ceil(tokens.length / 4) * SAMPLE_HEIGHT;
	await browserPage.viewport(1024, Math.max(768, canvas.height));
	const state = createScreenshotState();
	state.editorConfig.font = 'ibmvga8x16';
	const colors = {
		canvas: '#0b1020',
		surface: '#111b2e',
		ink: '#eff4ff',
		muted: '#879bb5',
		primary: '#70dbc1',
		secondary: '#edc678',
		tertiary: '#bb9fe1',
		highlight: '#f1db83',
		detail: '#80b9e6',
		stroke: 'rgba(112,219,193,0.3)',
		positive: '#69d58d',
		warning: '#efc660',
		negative: '#ef718a',
	};
	state.editorConfig.color = colors;
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	const codeBlocks = new Map<number, Array<Array<SpriteCell | null>>>();
	const drawers = createEditorDrawerRegistry();
	const palette = resolvePalette(colors);
	drawers.registerCodeBlockDrawer(({ draw, codeBlock }) => {
		// Keep each sample visible, including surface colors and dark foreground materials.
		const [r, g, b] = palette.rgba[tokens[codeBlock.creationIndex]];
		draw.drawFill(0, 0, PALETTE_INDICES[r + g + b > 1.5 ? 'black' : 'white'], codeBlock.width, codeBlock.height);
	});
	drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
		codeBlocks
			.get(codeBlock.creationIndex)!
			.forEach((cells, row) => draw.drawResolvedText(state.viewport.vGrid, row * state.viewport.hGrid, cells));
	});

	const renderer = await init(createStateManager(state), createMockEventDispatcher(), canvas, createMockMemoryViews(), {
		loading: { add: () => ({ done: () => {}, fail: () => {}, cancel: () => {} }) },
		drawers,
	});
	try {
		const characterLines = Array.from({ length: 16 }, (_, row) => CP437_CHARACTERS.slice(row * 16, (row + 1) * 16));
		for (const [index, token] of tokens.entries()) {
			const fontName = `font${token[0].toUpperCase()}${token.slice(1)}` as `font${Capitalize<typeof token>}`;
			const codeLines = ['', fontName, ...characterLines, ''];
			const block = createMockCodeBlock({
				creationIndex: index,
				x: (index % 4) * 256,
				y: Math.floor(index / 4) * SAMPLE_HEIGHT,
				width: 256,
				height: codeLines.length * 16,
			});
			state.codeBlockRendering.currentProject.blocks.push(block);
			codeBlocks.set(index, resolveFixtureCodeCells(codeLines, PALETTE_INDICES[token]));
		}
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot(`font-colors-${page}`);
	} finally {
		renderer.destroy();
		await browserPage.viewport(1024, 768);
	}
});
