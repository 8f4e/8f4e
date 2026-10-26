import { PALETTE_INDICES, PALETTE_TOKENS } from '@8f4e/editor-palette';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import init from '@8f4e/web-ui';
import type { CodeBlockRenderData, WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockSpriteData from './utils/createMockSpriteData';
import createMockStateWithColors from './utils/createMockStateWithColors';
import resolveFixtureCodeCells from './utils/resolveFixtureCodeCells';

const FONTS_PER_PAGE = 12;
const pages = Array.from({ length: Math.ceil(PALETTE_TOKENS.length / FONTS_PER_PAGE) }, (_, index) => ({
	page: index + 1,
	tokens: PALETTE_TOKENS.slice(index * FONTS_PER_PAGE, (index + 1) * FONTS_PER_PAGE),
}));

test.each(pages)('font color rendering page $page', async ({ page, tokens }) => {
	const canvas = createCanvas();
	canvas.height = Math.ceil(tokens.length / 4) * 192;
	const state = createMockStateWithColors();
	state.editorConfig.font = 'ibmvga8x16';
	state.featureFlags.modeOverlay = false;
	state.editorConfig.color = {
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
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	const codeBlocks = new Map<number, CodeBlockRenderData>();
	const renderData: WebUiRenderDataSource = { getSnapshot: () => ({ codeBlocks }) };
	const spriteData = await createMockSpriteData(state);
	const renderer = await init(state, renderData, canvas, createMockMemoryViews(), spriteData);
	try {
		renderer.pauseRendering();
		expect(state.spriteLookups).toBeDefined();
		const lookups = state.spriteLookups!;
		const characterLines = Array.from({ length: 8 }, (_, row) =>
			Array.from({ length: 16 }, (_, column) => String.fromCharCode(row * 16 + column)).join('')
		);
		for (const [index, token] of tokens.entries()) {
			const fontName = `font${token[0].toUpperCase()}${token.slice(1)}` as `font${Capitalize<typeof token>}`;
			const font = lookups.font;
			expect(font, `Missing palette font ${fontName}`).toBeDefined();
			const codeLines = ['', fontName, ...characterLines, ''];
			const block = createMockCodeBlock({
				creationIndex: index,
				x: (index % 4) * 256,
				y: Math.floor(index / 4) * 192,
				width: 256,
				height: codeLines.length * 16,
			});
			// Keep each sample visible, including surface colors and dark foreground materials.
			const [r, g, b] = spriteData.palette.rgba[token];
			block.widgets.blockHighlights.push({
				x: 0,
				y: 0,
				width: block.width,
				height: block.height,
				color: r + g + b > 1.5 ? 'black' : 'white',
			});
			state.codeBlockRendering.codeBlocks.push(block);
			codeBlocks.set(index, { codeCells: resolveFixtureCodeCells(codeLines, font, PALETTE_INDICES[token]) });
		}
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot(`font-colors-${page}`);
	} finally {
		renderer.destroy();
	}
});
