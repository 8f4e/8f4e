import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import type { TextureFormat } from '../src/directive';
import { TextureDrawer } from '../src/texture-drawer';

test('one program switches between all formats with packed odd-width rows and retained storage', () => {
	const canvas = document.createElement('canvas');
	canvas.width = 30;
	canvas.height = 6;
	const engine = new Engine(canvas);
	const drawer = new TextureDrawer(engine.gl);
	const gl = engine.gl;
	const cases: Array<{ format: TextureFormat; pixels: number[]; width: number; expected: number[][] }> = [
		{
			format: '1bit',
			width: 10,
			pixels: [170, 128, 85, 64],
			expected: Array.from({ length: 20 }, (_, i) => {
				const value = (Math.floor(i / 10) + (i % 10)) % 2 === 0 ? 255 : 0;
				return [value, value, value, 255];
			}),
		},
		{
			format: 'mono',
			width: 3,
			pixels: [0, 128, 255, 255, 64, 0],
			expected: [0, 128, 255, 255, 64, 0].map(value => [value, value, value, 255]),
		},
		{
			format: 'rgb',
			width: 3,
			pixels: [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0, 255],
			expected: [
				[255, 0, 0, 255],
				[0, 255, 0, 255],
				[0, 0, 255, 255],
				[255, 255, 0, 255],
				[0, 255, 255, 255],
				[255, 0, 255, 255],
			],
		},
		{
			format: 'rgba',
			width: 3,
			pixels: [255, 0, 0, 255, 0, 0, 255, 128, 0, 0, 0, 0, 255, 255, 0, 255, 0, 255, 0, 255, 255, 0, 255, 255],
			expected: [
				[255, 0, 0, 255],
				[0, 0, 128, 128],
				[0, 0, 0, 0],
				[255, 255, 0, 255],
				[0, 255, 0, 255],
				[255, 0, 255, 255],
			],
		},
	];
	try {
		for (const item of cases) {
			engine.resize(item.width * 3, 6);
			for (const stage of ['allocate', 'update', 'restore']) {
				if (stage === 'restore') drawer.releaseMemory();
				engine.hooks.postDraw.length = 0;
				engine.hooks.postDraw.push(() => {
					drawer.upload('view', new Uint8Array(item.pixels), item.width, 2, item.format);
					drawer.drawTexture('view', 0, 0, canvas.width, canvas.height);
				});
				engine.renderFrame(() => {});
				const actual = new Uint8Array(canvas.width * canvas.height * 4);
				gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, actual);
				for (let y = 0; y < canvas.height; y++)
					for (let x = 0; x < canvas.width; x++) {
						const offset = ((canvas.height - 1 - y) * canvas.width + x) * 4;
						expect([...actual.subarray(offset, offset + 4)], `${item.format}, ${stage}, ${x},${y}`).toEqual(
							item.expected[Math.floor(y / 3) * item.width + Math.floor(x / 3)]
						);
					}
				expect(gl.getError()).toBe(gl.NO_ERROR);
			}
		}
	} finally {
		drawer.destroy();
		engine.destroy();
	}
});
