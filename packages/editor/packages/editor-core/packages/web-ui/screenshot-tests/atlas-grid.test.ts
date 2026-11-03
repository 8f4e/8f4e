import loadFontAtlas, { FONT_NAMES, getGlyphSpriteId } from '@8f4e/sprite-generator';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';

for (const font of FONT_NAMES) {
	test(`grid addressing preserves every cell, clipping, palette alpha, and restoration with ${font}`, async () => {
		const canvas = document.createElement('canvas');
		const engine = new Engine(canvas);
		const gl = engine.gl;
		const colors = [
			[200, 100, 50, 255],
			[40, 180, 220, 128],
			[255, 0, 255, 0],
		];
		engine.setPalette(new Uint8Array(colors.flat()));
		try {
			// Replacing a different font on the same renderer also changes the grid uniforms.
			const previous = await loadFontAtlas('spleen16x32');
			engine.setSpriteAtlas(previous.image, previous.grid);
			const spriteAtlas = await loadFontAtlas(font);
			const { image, grid } = spriteAtlas;
			engine.setSpriteAtlas(image, grid);
			engine.resize(image.width + 3, image.height + 5);
			const commands: Array<[number, number, number, number, number, number]> = [];
			for (let id = 0; id < grid.cellCount; id++) {
				commands.push([
					(id % grid.columns) * grid.cellWidth,
					Math.floor(id / grid.columns) * grid.cellHeight,
					id,
					id % 3,
					grid.cellWidth,
					grid.cellHeight,
				]);
			}
			commands.push([-3, 2, 87, 1, grid.cellWidth * 2, grid.cellHeight * 2]);
			commands.push([image.width - 2, 1, 128, 1, 13, 7]);
			commands.push([3, image.height - 2, 128, 0, 9, 11]);
			commands.push([2, 3, getGlyphSpriteId(1000), 1, grid.cellWidth, grid.cellHeight]);
			commands.push([0, 0, 128, 2, canvas.width, canvas.height]);
			const expected = (destinationAlpha: number) => {
				const pixels = new Uint8Array(canvas.width * canvas.height * 4);
				for (let i = 0; i < pixels.length; i += 4) pixels.set([0, 0, 0, destinationAlpha], i);
				for (const [x, y, id, color, width, height] of commands) {
					const sourceX = (id % 16) * grid.cellWidth;
					const sourceY = Math.floor(id / 16) * grid.cellHeight;
					const alpha = colors[color][3] / 255;
					for (let dy = Math.max(0, y); dy < Math.min(canvas.height, y + height); dy++) {
						for (let dx = Math.max(0, x); dx < Math.min(canvas.width, x + width); dx++) {
							const tx = sourceX + Math.floor(((dx + 0.5 - x) * grid.cellWidth) / width);
							const ty = sourceY + Math.floor(((dy + 0.5 - y) * grid.cellHeight) / height);
							if (image.data[ty * image.width + tx] === 0) continue;
							const offset = ((canvas.height - 1 - dy) * canvas.width + dx) * 4;
							for (let channel = 0; channel < 4; channel++) {
								pixels[offset + channel] = Math.round(
									(channel === 3 ? 255 : colors[color][channel]) * alpha + pixels[offset + channel] * (1 - alpha)
								);
							}
						}
					}
				}
				return pixels;
			};
			for (const destinationAlpha of [0, 128, 255]) {
				const reference = expected(destinationAlpha);
				const render = () => {
					engine.renderFrame(() => {
						gl.clearColor(0, 0, 0, destinationAlpha / 255);
						gl.clear(gl.COLOR_BUFFER_BIT);
						for (const command of commands) engine.drawSprite(...command);
					});
					const pixels = new Uint8Array(reference.length);
					gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
					return pixels;
				};
				const initial = render();
				let maxDelta = 0;
				for (let i = 0; i < initial.length; i++) maxDelta = Math.max(maxDelta, Math.abs(initial[i] - reference[i]));
				expect(maxDelta).toBeLessThanOrEqual(1);
				const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
				const dirty = () => {
					gl.useProgram(program);
					gl.uniform1ui(gl.getUniformLocation(program, 'u_columns'), 1);
					gl.uniform2f(gl.getUniformLocation(program, 'u_cellSize'), 1, 1);
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, null);
				};
				engine.hooks.preDraw.push(dirty);
				expect(render()).toEqual(initial);
				engine.releaseRenderingMemory();
				engine.restoreRenderingMemory();
				expect(render()).toEqual(initial);
				engine.hooks.preDraw.pop();
				expect(gl.getError()).toBe(gl.NO_ERROR);
			}
		} finally {
			engine.destroy();
		}
	});
}
