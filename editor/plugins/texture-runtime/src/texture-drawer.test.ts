import { expect, it } from 'vitest';
import { createFakeWebGl } from './__tests__/fake-webgl';
import { TextureDrawer } from './texture-drawer';

it('reuses texture storage until the dimensions change and recreates released storage', () => {
	const gl = createFakeWebGl();
	const drawer = new TextureDrawer(gl);
	drawer.upload(0, new Uint8Array(8), 2, 1, 'rgba');
	drawer.upload(0, new Uint8Array(8), 2, 1, 'rgba');
	drawer.upload(0, new Uint8Array(4), 1, 1, 'rgba');
	expect(gl.createTexture).toHaveBeenCalledOnce();
	expect(gl.texImage2D).toHaveBeenCalledTimes(2);
	expect(gl.texSubImage2D).toHaveBeenCalledOnce();
	drawer.releaseMemory();
	drawer.upload(0, new Uint8Array(4), 1, 1, 'rgba');
	expect(gl.createTexture).toHaveBeenCalledTimes(2);
	expect(gl.texImage2D).toHaveBeenCalledTimes(3);
	drawer.destroy();
	expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
	expect(gl.deleteProgram).toHaveBeenCalledOnce();
	expect(gl.deleteBuffer).toHaveBeenCalledOnce();
	expect(gl.deleteVertexArray).toHaveBeenCalledOnce();
});

it('shares a program across formats and releases storage for removed directives', () => {
	const gl = createFakeWebGl();
	const drawer = new TextureDrawer(gl);
	drawer.upload(0, new Uint8Array(4), 10, 2, '1bit');
	drawer.upload(16, new Uint8Array(18), 3, 2, 'rgb');
	expect(gl.createProgram).toHaveBeenCalledOnce();
	expect(gl.createVertexArray).toHaveBeenCalledOnce();
	expect(gl.createTexture).toHaveBeenCalledTimes(2);
	drawer.retainTextures(new Set([0]));
	expect(gl.deleteTexture).toHaveBeenCalledOnce();
	drawer.destroy();
	expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
});
