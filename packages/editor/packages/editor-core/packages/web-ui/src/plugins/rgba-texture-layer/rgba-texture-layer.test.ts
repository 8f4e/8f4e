import { describe, expect, it, vi } from 'vitest';

import { createPluginHost } from '../__tests__/fake-webgl';
import { RgbaTextureLayer } from './rgba-texture-layer';

describe('RgbaTextureLayer', () => {
	it('creates, updates, and resizes reusable RGBA8 texture storage', () => {
		const { gl, hooks } = createPluginHost();
		const layer = new RgbaTextureLayer({ gl, hooks });
		const firstPixels = new Uint8Array(8);
		const texture = layer.uploadRgba8Texture(firstPixels, 2, 1);
		expect(gl.createTexture).toHaveBeenCalledOnce();
		expect(gl.texImage2D).toHaveBeenCalledOnce();

		const updated = layer.uploadRgba8Texture(new Uint8ClampedArray(8), 2, 1, { texture, filter: 'linear' });
		expect(updated).toBe(texture);
		expect(texture.filter).toBe('linear');
		expect(gl.texSubImage2D).toHaveBeenCalledOnce();
		expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

		layer.uploadRgba8Texture(new Uint8Array(4), 1, 1, { texture });
		expect(texture.width).toBe(1);
		expect(texture.height).toBe(1);
		expect(gl.texImage2D).toHaveBeenCalledTimes(2);
	});

	it('runs its draw callback in the configured phase and draws top-left rectangles', () => {
		const { gl, hooks } = createPluginHost();
		const layer = new RgbaTextureLayer({ gl, hooks }, { phase: 'postDraw' });
		const texture = layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
		const callback = vi.fn(() => layer.drawTexture(texture, 10, 20, 30, 40, 0.5));
		layer.setDrawCallback(callback);

		expect(hooks.preDraw).toEqual([]);
		expect(hooks.postDraw).toHaveLength(1);
		hooks.postDraw[0](gl);

		expect(callback).toHaveBeenCalledOnce();
		expect(gl.uniform2f).toHaveBeenCalledWith(expect.objectContaining({ name: 'u_resolution' }), 320, 200);
		expect(gl.uniform4f).toHaveBeenCalledWith(expect.objectContaining({ name: 'u_rectangle' }), 10, 20, 30, 40);
		expect(gl.uniform1f).toHaveBeenCalledWith(expect.objectContaining({ name: 'u_alpha' }), 0.5);
		expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4);
	});

	it('releases texture storage and recreates it through the existing handle on the next upload', () => {
		const { gl } = createPluginHost();
		const layer = new RgbaTextureLayer({ gl, hooks: { preDraw: [], postDraw: [] } });
		const texture = layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
		const originalGpuTexture = texture.texture;
		gl.createTexture.mockClear();
		gl.deleteTexture.mockClear();
		gl.texImage2D.mockClear();
		gl.texSubImage2D.mockClear();

		layer.releaseMemory();
		layer.releaseMemory();

		expect(gl.deleteTexture).toHaveBeenCalledOnce();

		const restored = layer.uploadRgba8Texture(new Uint8Array(4), 1, 1, { texture });

		expect(restored).toBe(texture);
		expect(texture.texture).not.toBe(originalGpuTexture);
		expect(gl.createTexture).toHaveBeenCalledOnce();
		expect(gl.texImage2D).toHaveBeenCalledOnce();
		expect(gl.texSubImage2D).not.toHaveBeenCalled();
	});

	it('validates cold uploads and deletes owned resources idempotently', () => {
		const { gl, hooks } = createPluginHost();
		const layer = new RgbaTextureLayer({ gl, hooks });
		expect(() => layer.uploadRgba8Texture(new Uint8Array(3), 1, 1)).toThrow('too small');
		const first = layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
		layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);

		layer.deleteTexture(first);
		layer.deleteTexture(first);
		layer.destroy();
		layer.destroy();

		expect(hooks.preDraw).toEqual([]);
		expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
		expect(gl.deleteProgram).toHaveBeenCalledOnce();
		expect(gl.deleteBuffer).toHaveBeenCalledOnce();
		expect(gl.deleteVertexArray).toHaveBeenCalledOnce();
	});
});
