import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';

test('samples odd-width R8 coverage with premultiplied RGBA and updates only palette storage', () => {
	const canvas = document.createElement('canvas');
	canvas.width = 3;
	canvas.height = 2;
	const engine = new Engine(canvas);
	const gl = engine.gl;
	const id = engine
		.setSpriteAtlas(
			{ width: 3, height: 2, data: new Uint8Array([0, 128, 255, 255, 0, 128]) },
			{
				mask: { x: 0, y: 0, spriteWidth: 3, spriteHeight: 2 },
			}
		)
		.resolveSprite('mask');
	const colors = new Uint8Array([200, 100, 50, 128]);
	engine.setPalette(colors);
	const read = () => {
		engine.renderFrame(() => engine.drawSprite(0, 0, id, 0));
		const pixels = new Uint8Array(24);
		gl.readPixels(0, 0, 3, 2, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		expect(gl.getError()).toBe(gl.NO_ERROR);
		return [...pixels];
	};
	try {
		expect(read()).toEqual([
			100, 50, 25, 128, 0, 0, 0, 0, 50, 25, 13, 64, 0, 0, 0, 0, 50, 25, 13, 64, 100, 50, 25, 128,
		]);
		// Poison transfer state as a render hook could; palette uploads must establish their own row layout.
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 8);
		gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 7);
		engine.setPalette(new Uint8Array([0, 255, 0, 255]));
		expect(read()).toEqual([0, 255, 0, 255, 0, 0, 0, 0, 0, 128, 0, 128, 0, 0, 0, 0, 0, 128, 0, 128, 0, 255, 0, 255]);
		expect(engine.frameStats).toEqual({ spriteCount: 1, uploadedInstanceBytes: 20 });
		engine.releaseRenderingMemory();
		engine.setPalette(colors);
		engine.restoreRenderingMemory();
		expect(read()).toEqual([
			100, 50, 25, 128, 0, 0, 0, 0, 50, 25, 13, 64, 0, 0, 0, 0, 50, 25, 13, 64, 100, 50, 25, 128,
		]);
	} finally {
		engine.destroy();
	}
});
