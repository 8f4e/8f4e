import loadFontAtlas, { FILL_SPRITE_ID } from '@8f4e/sprite-generator';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { LineDrawer } from '../src/plugins/line-drawer';
import { RgbaTextureLayer } from '../src/plugins/rgba-texture-layer';

test('RGBA overlays use nearest filtering and per-pixel alpha above sprites and lines, including after restoration', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 8;
	canvas.height = 8;
	const engine = new Engine(canvas);
	const lines = new LineDrawer(engine);
	const overlay = new RgbaTextureLayer(engine);
	try {
		const spriteAtlas = await loadFontAtlas();
		engine.setSpriteAtlas(spriteAtlas.image, spriteAtlas.grid);
		const fill = FILL_SPRITE_ID;
		engine.setPalette(new Uint8Array([255, 0, 0, 255]));
		const pixels = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 128, 0, 0, 0, 0, 255, 255, 0, 255]);
		overlay.setDrawCallback(layer => {
			layer.uploadRgba8Texture(pixels, 2, 2);
			layer.drawTexture(0, 0, 8, 8);
		});
		for (const restore of [false, true]) {
			if (restore) {
				overlay.releaseMemory();
				lines.releaseMemory();
				engine.releaseRenderingMemory();
				engine.restoreRenderingMemory();
			}
			engine.renderFrame(() => {
				engine.drawSprite(0, 0, fill, 0, 8, 8);
				lines.drawLine(-1, 4, 9, 4, 8, [0, 1, 0, 1]);
			});
			const actual = new Uint8Array(8 * 8 * 4);
			engine.gl.readPixels(0, 0, 8, 8, engine.gl.RGBA, engine.gl.UNSIGNED_BYTE, actual);
			const quadrants = [
				[255, 0, 0, 255],
				[0, 127, 128, 255],
				[0, 255, 0, 255],
				[255, 255, 0, 255],
			];
			for (let y = 0; y < 8; y++) {
				for (let x = 0; x < 8; x++) {
					const offset = ((7 - y) * 8 + x) * 4;
					expect([...actual.subarray(offset, offset + 4)]).toEqual(
						quadrants[Math.floor(y / 4) * 2 + Math.floor(x / 4)]
					);
				}
			}
			expect(engine.gl.getError()).toBe(engine.gl.NO_ERROR);
		}
	} finally {
		overlay.destroy();
		lines.destroy();
		engine.destroy();
	}
});
