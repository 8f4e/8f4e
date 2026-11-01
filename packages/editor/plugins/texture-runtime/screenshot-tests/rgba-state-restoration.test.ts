import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { TextureDrawer } from '../src/texture-drawer';

function readPixels(gl: WebGL2RenderingContext, width: number, height: number): Uint8Array {
	const pixels = new Uint8Array(width * height * 4);
	gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
	return pixels;
}

test('restores nearest overlay sampling after raw hooks without a sprite pass', () => {
	const canvas = document.createElement('canvas');
	const engine = new Engine(canvas);
	const gl = engine.gl;
	const sampler = gl.createSampler()!;
	gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, gl.REPEAT);
	engine.hooks.postDraw.push(context => context.bindSampler(0, sampler));
	const overlay = new TextureDrawer(engine.gl);
	const pixels = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 128, 0, 0, 0, 0, 255, 255, 0, 255]);
	let destinationAlpha = 0;
	engine.hooks.preDraw.push(context => {
		context.clearColor(0, destinationAlpha / 255, 0, destinationAlpha / 255);
		context.clear(context.COLOR_BUFFER_BIT);
	});
	engine.hooks.postDraw.push(() =>
		overlay.drawTexture(0, 0, 0, canvas.width, canvas.height, { x: 0, y: 0, width: 2, height: 2 })
	);
	try {
		for (const [stage, width, height] of [
			['initial', 8, 8],
			['resized', 12, 8],
			['restored', 8, 12],
		] as const) {
			if (stage === 'restored') {
				overlay.releaseMemory();
				engine.releaseRenderingMemory();
				engine.restoreRenderingMemory();
			}
			engine.resize(width, height);
			overlay.upload(0, pixels, 2, 2, 'rgba');
			for (const alpha of [0, 128, 255]) {
				destinationAlpha = alpha;
				engine.renderFrame(() => {});
				const actual = readPixels(gl, width, height);
				const quadrants = [
					[255, 0, 0, 255],
					[0, Math.round((alpha * 127) / 255), 128, Math.round(128 + (alpha * 127) / 255)],
					[0, alpha, 0, alpha],
					[255, 255, 0, 255],
				];
				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x++) {
						const offset = ((height - 1 - y) * width + x) * 4;
						expect([...actual.subarray(offset, offset + 4)], `${stage}, alpha=${alpha}`).toEqual(
							quadrants[Math.floor((y * 2) / height) * 2 + Math.floor((x * 2) / width)]
						);
					}
				}
				expect(gl.getError(), stage).toBe(gl.NO_ERROR);
			}
		}
	} finally {
		overlay.destroy();
		gl.deleteSampler(sampler);
		engine.destroy();
	}
});

for (const dirtyState of ['row layout', 'unpack buffer', 'flip and premultiplication'] as const) {
	test(`restores overlay uploads after raw hooks change ${dirtyState}`, () => {
		const canvas = document.createElement('canvas');
		const engine = new Engine(canvas);
		const gl = engine.gl;
		const unpackBuffer = gl.createBuffer();
		gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, unpackBuffer);
		gl.bufferData(gl.PIXEL_UNPACK_BUFFER, 256, gl.STATIC_DRAW);
		gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
		let width = 3;
		let height = 2;
		let pixels = new Uint8Array();
		engine.hooks.postDraw.push(context => {
			if (dirtyState === 'row layout') {
				context.pixelStorei(context.UNPACK_ALIGNMENT, 8);
				context.pixelStorei(context.UNPACK_ROW_LENGTH, width + 3);
				context.pixelStorei(context.UNPACK_IMAGE_HEIGHT, height + 2);
				context.pixelStorei(context.UNPACK_SKIP_PIXELS, 1);
				context.pixelStorei(context.UNPACK_SKIP_ROWS, 1);
				context.pixelStorei(context.UNPACK_SKIP_IMAGES, 1);
			} else if (dirtyState === 'unpack buffer') {
				context.bindBuffer(context.PIXEL_UNPACK_BUFFER, unpackBuffer);
			} else {
				context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);
				context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
			}
		});
		const overlay = new TextureDrawer(engine.gl);
		engine.hooks.postDraw.push(() => {
			overlay.upload(0, pixels, width, height, 'rgba');
			overlay.drawTexture(0, 0, 0, canvas.width, canvas.height, { x: 0, y: 0, width, height });
		});
		try {
			for (const [version, stage] of ['allocate', 'update', 'resize', 'restore'].entries()) {
				if (stage === 'resize') {
					width = 2;
					height = 3;
				}
				if (stage === 'restore') {
					overlay.releaseMemory();
					engine.releaseRenderingMemory();
					engine.restoreRenderingMemory();
				}
				engine.resize(width * 3, height * 3);
				pixels = new Uint8Array(width * height * 4);
				for (let i = 0; i < width * height; i++) {
					const value = i + version;
					pixels.set([value & 1 ? 255 : 0, value & 2 ? 255 : 0, value & 4 ? 255 : 0, [0, 128, 255][value % 3]], i * 4);
				}
				engine.renderFrame(() => {});
				expect(gl.getError(), stage).toBe(gl.NO_ERROR);
				const actual = readPixels(gl, canvas.width, canvas.height);
				for (let y = 0; y < canvas.height; y++) {
					for (let x = 0; x < canvas.width; x++) {
						const source = (Math.floor(y / 3) * width + Math.floor(x / 3)) * 4;
						const alpha = pixels[source + 3];
						const expected = [...pixels.subarray(source, source + 3)].map(channel => (channel * alpha) / 255);
						expected.push(alpha);
						const offset = ((canvas.height - 1 - y) * canvas.width + x) * 4;
						expect([...actual.subarray(offset, offset + 4)], stage).toEqual(expected);
					}
				}
				expect(gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING), stage).toBeNull();
				expect(gl.getParameter(gl.UNPACK_ALIGNMENT), stage).toBe(1);
				for (const parameter of [
					gl.UNPACK_ROW_LENGTH,
					gl.UNPACK_IMAGE_HEIGHT,
					gl.UNPACK_SKIP_PIXELS,
					gl.UNPACK_SKIP_ROWS,
					gl.UNPACK_SKIP_IMAGES,
				]) {
					expect(gl.getParameter(parameter), stage).toBe(0);
				}
				expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), stage).toBe(false);
				expect(gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), stage).toBe(false);
				expect(gl.getError(), stage).toBe(gl.NO_ERROR);
			}
		} finally {
			overlay.destroy();
			gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
			gl.deleteBuffer(unpackBuffer);
			engine.destroy();
		}
	});
}
