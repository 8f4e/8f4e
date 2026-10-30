import { PALETTE_INDICES, type PaletteConfig, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import loadFontAtlas, { FILL_SPRITE_ID, type Font } from '@8f4e/sprite-generator';
import { DrawContext } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import drawConnectors from '../src/drawer/connectors';
import type { ConnectorWidgets } from '../src/types';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';

const themes: Array<{ name: string; palette: PaletteConfig }> = [
	{ name: 'default', palette: {} },
	{ name: 'distinct', palette: { surface: '#092a35', primary: '#ffcc33', secondary: '#ff66cc' } },
	{ name: 'translucent', palette: { surface: '#092a3580', primary: '#ffcc3380', secondary: '#ff66cc80' } },
];

for (const font of ['6x10', 'ibmvga8x16', 'spleen16x32'] satisfies Font[]) {
	for (const { name, palette } of themes) {
		test(`connectors with ${font} and ${name} colors`, async () => {
			const spriteAtlas = await loadFontAtlas(font);
			const { cellWidth: characterWidth, cellHeight: characterHeight } = spriteAtlas.grid;
			const canvas = createCanvas();
			canvas.width = characterWidth * 29;
			canvas.height = characterHeight * 3;
			const engine = new Engine(canvas);
			engine.setPalette(toPaletteBytes(resolvePalette(palette)));
			engine.setSpriteAtlas(spriteAtlas.image, spriteAtlas.grid);
			const state = createMockState({
				viewport: { vGrid: characterWidth, hGrid: characterHeight },
			});
			const block = createMockCodeBlock();
			const widgets: ConnectorWidgets = { inputs: [], outputs: [] };
			widgets.inputs.push({
				codeBlock: block,
				x: characterWidth,
				y: characterHeight,
				width: characterWidth * 3,
				height: characterHeight,
				wireX: 0,
				wireY: 0,
				id: 'input',
				allocationUnitAddress: 0,
			});
			const memoryViews = createMockMemoryViews();
			for (const [index, value] of [-1, -0.6, -0.2, 0.2, 0.6, 1].entries()) {
				memoryViews.float32[index] = value;
				widgets.outputs.push({
					codeBlock: block,
					x: characterWidth * (5 + index * 4),
					y: characterHeight,
					width: characterWidth * 3,
					height: characterHeight,
					wireX: 0,
					wireY: 0,
					id: `output${index}`,
					calibratedMax: 1,
					calibratedMin: -1,
					memory: {
						id: `value${index}`,
						type: 'float',
						numberOfElements: 1,
						elementWordSize: 4,
						byteAddress: index * 4,
						elementByteLength: 4,
						allocationUnitAddress: index,
						allocationUnitCount: 1,
						allocatedByteLength: 4,
						endByteAddress: index * 4,
						endAddressSafeByteLength: 4,
						lineNumber: 0,
						isInteger: false,
						pointerDepth: 0,
						isUnsigned: false,
					},
				});
			}
			try {
				engine.renderFrame(() => {
					engine.drawSprite(0, 0, FILL_SPRITE_ID, PALETTE_INDICES.white, canvas.width, canvas.height);
					drawConnectors(new DrawContext(engine, characterWidth), state, widgets, memoryViews);
				});
				await expect(canvas).toMatchScreenshot();
			} finally {
				engine.destroy();
			}
		});
	}
}
