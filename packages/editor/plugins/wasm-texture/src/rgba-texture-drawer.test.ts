import { expect, it } from 'vitest';
import { createFakeWebGl } from './__tests__/fake-webgl';
import { RgbaTextureDrawer } from './rgba-texture-drawer';

it('reuses texture storage until the dimensions change and recreates released storage', () => {
	const gl = createFakeWebGl();
	const drawer = new RgbaTextureDrawer(gl);
	drawer.uploadRgba8Texture(new Uint8Array(8), 2, 1);
	drawer.uploadRgba8Texture(new Uint8Array(8), 2, 1);
	drawer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
	expect(gl.createTexture).toHaveBeenCalledOnce();
	expect(gl.texImage2D).toHaveBeenCalledTimes(2);
	expect(gl.texSubImage2D).toHaveBeenCalledOnce();
	drawer.releaseMemory();
	drawer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
	expect(gl.createTexture).toHaveBeenCalledTimes(2);
	expect(gl.texImage2D).toHaveBeenCalledTimes(3);
	drawer.destroy();
	expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
	expect(gl.deleteProgram).toHaveBeenCalledOnce();
	expect(gl.deleteBuffer).toHaveBeenCalledOnce();
	expect(gl.deleteVertexArray).toHaveBeenCalledOnce();
});

it('draws its uploaded pixels in canvas coordinates with nearest sampling', () => {
	const gl = createFakeWebGl();
	const drawer = new RgbaTextureDrawer(gl);
	drawer.uploadRgba8Texture(new Uint8Array(4), 1, 1);
	drawer.drawTexture(10, 20, 30, 40);
	expect(gl.uniform2f).toHaveBeenCalledWith(expect.objectContaining({ name: 'u_pixelToClip' }), 2 / 320, -2 / 200);
	expect(gl.uniform4f).toHaveBeenCalledWith(expect.objectContaining({ name: 'u_rectangle' }), 10, 20, 30, 40);
	expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	expect(gl.bindSampler).toHaveBeenCalledWith(0, null);
	expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4);
	drawer.destroy();
});
