import type { RenderHook, RenderPluginHost } from 'glugglugglug';
import { createProgram, prepareRenderPass, removeHook, requireResource, requireUniform } from '../webgl';
import { createRectangleGeometry, deleteRectangleGeometry, type RectangleGeometry } from './geometry';

const textureVertexShaderSource = `#version 300 es
	precision highp float;

	layout(location = 0) in vec2 a_position;

	uniform vec2 u_resolution;
	uniform vec4 u_rectangle;

	out vec2 v_textureCoordinate;

	void main() {
		vec2 corner = (a_position + 1.0) * 0.5;
		vec2 pixelPosition = u_rectangle.xy + corner * u_rectangle.zw;
		vec2 clipPosition = pixelPosition / u_resolution * 2.0 - 1.0;
		gl_Position = vec4(clipPosition * vec2(1.0, -1.0), 0.0, 1.0);
		v_textureCoordinate = corner;
	}
`;

const textureFragmentShaderSource = `#version 300 es
	precision mediump float;

	in vec2 v_textureCoordinate;
	uniform sampler2D u_texture;

	out vec4 outColor;

	void main() {
		vec4 color = texture(u_texture, v_textureCoordinate);
		outColor = vec4(color.rgb * color.a, color.a);
	}
`;

/** Uploads and draws caller-owned RGBA8 pixels in an overlay above sprites and lines. */
export class RgbaTextureLayer {
	private readonly gl: WebGL2RenderingContext;
	private readonly hooks: RenderPluginHost['hooks'];
	private readonly geometry: RectangleGeometry;
	private readonly program: WebGLProgram;
	private readonly resolutionLocation: WebGLUniformLocation;
	private readonly rectangleLocation: WebGLUniformLocation;
	private readonly textureLocation: WebGLUniformLocation;
	private texture: WebGLTexture | null = null;
	private width = 0;
	private height = 0;
	private drawCallback: ((layer: RgbaTextureLayer) => void) | null = null;
	private destroyed = false;

	/** Invokes the current layer callback from its overlay render phase. */
	private readonly drawHook: RenderHook = () => {
		this.drawCallback?.(this);
	};

	/**
	 * Creates and attaches an initially empty overlay texture layer.
	 *
	 * @param host - Engine or compatible render-plugin host.
	 */
	constructor(host: RenderPluginHost) {
		this.gl = host.gl;
		this.hooks = host.hooks;
		const geometry = createRectangleGeometry(this.gl);
		let program: WebGLProgram | null = null;
		try {
			program = createProgram(this.gl, textureVertexShaderSource, textureFragmentShaderSource, 'RGBA texture layer');
			this.resolutionLocation = requireUniform(this.gl, program, 'u_resolution');
			this.rectangleLocation = requireUniform(this.gl, program, 'u_rectangle');
			this.textureLocation = requireUniform(this.gl, program, 'u_texture');
		} catch (error) {
			if (program) {
				this.gl.deleteProgram(program);
			}
			deleteRectangleGeometry(this.gl, geometry);
			throw error;
		}
		this.geometry = geometry;
		this.program = program;
		this.hooks.postDraw.push(this.drawHook);
	}

	/**
	 * Sets the callback that uploads and draws the current overlay after sprites and lines.
	 *
	 * @param callback - Per-frame texture update/draw callback.
	 */
	setDrawCallback(callback: (layer: RgbaTextureLayer) => void): void {
		this.drawCallback = callback;
	}

	/** Uploads the overlay's RGBA8 pixels, reusing same-sized GPU storage. */
	uploadRgba8Texture(data: Uint8Array, width: number, height: number): void {
		assertTextureInput(data, width, height);
		const gl = this.gl;
		const sizeChanged = this.texture === null || this.width !== width || this.height !== height;
		if (this.texture === null) this.texture = requireResource(gl.createTexture(), 'RGBA8 overlay texture');
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
		gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
		gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
		gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
		gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0);
		gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, 0);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		if (sizeChanged) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
		} else {
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
		}
		this.width = width;
		this.height = height;
	}

	/** Draws the uploaded overlay in canvas pixels with its own per-pixel alpha and nearest filtering. */
	drawTexture(x: number, y: number, width: number, height: number): void {
		const gl = this.gl;
		prepareRenderPass(gl, this.program, this.geometry.vertexArray);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.bindSampler(0, null);
		gl.uniform1i(this.textureLocation, 0);
		gl.uniform2f(this.resolutionLocation, gl.drawingBufferWidth, gl.drawingBufferHeight);
		gl.uniform4f(this.rectangleLocation, x, y, width, height);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	/** Releases overlay pixel storage; the next upload recreates it. */
	releaseMemory(): void {
		if (this.texture !== null) {
			this.gl.deleteTexture(this.texture);
			this.texture = null;
		}
	}

	/** Detaches the hook and deletes the overlay's WebGL resources. */
	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		removeHook(this.hooks.postDraw, this.drawHook);
		this.releaseMemory();
		this.gl.deleteProgram(this.program);
		deleteRectangleGeometry(this.gl, this.geometry);
		this.drawCallback = null;
	}
}

/**
 * Validates cold RGBA upload dimensions and storage length.
 *
 * @param data - Pixel array to validate.
 * @param width - Requested texture width.
 * @param height - Requested texture height.
 */
function assertTextureInput(data: Uint8Array, width: number, height: number): void {
	if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
		throw new RangeError('RGBA8 texture dimensions must be positive integers.');
	}
	const requiredByteLength = width * height * 4;
	if (data.byteLength < requiredByteLength) {
		throw new RangeError(`RGBA8 texture data is too small: expected at least ${requiredByteLength} bytes.`);
	}
}
