import { describe, expect, it, vi } from 'vitest';
import { createPluginHost } from '../__tests__/fake-webgl';
import { RgbaTextureLayer } from './rgba-texture-layer';

describe('RGBA overlay', () => {
	it('reuses one nearest-filtered texture and reallocates storage when its dimensions change', () => {
		const { gl, hooks } = createPluginHost();
		const layer = new RgbaTextureLayer({ gl, hooks });
		layer.uploadRgba8Texture(new Uint8Array(8), 2, 1);
		layer.uploadRgba8Texture(new Uint8Array(8), 2, 1);
		layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
		expect(gl.createTexture).toHaveBeenCalledOnce();
		expect(gl.texImage2D).toHaveBeenCalledTimes(2);
		expect(gl.texSubImage2D).toHaveBeenCalledOnce();
		expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		layer.destroy();
	});

	it('draws its uploaded image above sprites and lines in canvas coordinates', () => {
		const { gl, hooks } = createPluginHost();
		const layer = new RgbaTextureLayer({ gl, hooks });
		const callback = vi.fn(() => {
			layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
			layer.drawTexture(10, 20, 30, 40);
		});
		layer.setDrawCallback(callback);
		expect(hooks.preDraw).toEqual([]);
		expect(hooks.postDraw).toHaveLength(1);
		hooks.postDraw[0](gl);
		expect(callback).toHaveBeenCalledOnce();
		expect(gl.uniform2f).toHaveBeenCalledWith(expect.objectContaining({ name: 'u_resolution' }), 320, 200);
		expect(gl.uniform4f).toHaveBeenCalledWith(expect.objectContaining({ name: 'u_rectangle' }), 10, 20, 30, 40);
		expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4);
		layer.destroy();
	});

	it('releases texture storage once and recreates it on the next upload', () => {
		const { gl, hooks } = createPluginHost();
		const layer = new RgbaTextureLayer({ gl, hooks });
		layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
		layer.releaseMemory();
		layer.releaseMemory();
		expect(gl.deleteTexture).toHaveBeenCalledOnce();
		layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
		expect(gl.createTexture).toHaveBeenCalledTimes(2);
		expect(gl.texImage2D).toHaveBeenCalledTimes(2);
		expect(gl.texSubImage2D).not.toHaveBeenCalled();
		layer.destroy();
		expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
	});

	it('validates pixel storage and deletes only its own resources idempotently', () => {
		const { gl, hooks } = createPluginHost();
		const other = vi.fn();
		hooks.postDraw.push(other);
		const layer = new RgbaTextureLayer({ gl, hooks });
		expect(() => layer.uploadRgba8Texture(new Uint8Array(3), 1, 1)).toThrow('too small');
		layer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
		layer.releaseMemory();
		layer.destroy();
		layer.destroy();
		expect(hooks.postDraw).toEqual([other]);
		expect(gl.deleteTexture).toHaveBeenCalledOnce();
		expect(gl.deleteProgram).toHaveBeenCalledOnce();
		expect(gl.deleteBuffer).toHaveBeenCalledOnce();
		expect(gl.deleteVertexArray).toHaveBeenCalledOnce();
	});
});
