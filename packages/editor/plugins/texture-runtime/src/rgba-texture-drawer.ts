import { createProgram, prepareRenderPass, requireResource, requireUniform } from '@8f4e/web-ui';
import { createRectangleGeometry, deleteRectangleGeometry, type RectangleGeometry } from './geometry';

const textureVertexShaderSource = `#version 300 es
	precision highp float;

	layout(location = 0) in vec2 a_position;

	uniform vec2 u_pixelToClip;
	uniform vec4 u_rectangle;

	out vec2 v_textureCoordinate;

	void main() {
		vec2 corner = (a_position + 1.0) * 0.5;
		vec2 pixelPosition = u_rectangle.xy + corner * u_rectangle.zw;
		gl_Position = vec4(pixelPosition * u_pixelToClip + vec2(-1.0, 1.0), 0.0, 1.0);
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
export class RgbaTextureDrawer {
	private readonly gl: WebGL2RenderingContext;
	private readonly geometry: RectangleGeometry;
	private readonly program: WebGLProgram;
	private readonly pixelToClipLocation: WebGLUniformLocation;
	private readonly rectangleLocation: WebGLUniformLocation;
	private readonly textureLocation: WebGLUniformLocation;
	private texture: WebGLTexture | null = null;
	private width = 0;
	private height = 0;
	private destroyed = false;

	/**
	 * Creates the shader and rectangle used to draw framebuffer pixels.
	 *
	 * @param gl - WebGL context that owns the resources.
	 */
	constructor(gl: WebGL2RenderingContext) {
		this.gl = gl;
		const geometry = createRectangleGeometry(this.gl);
		let program: WebGLProgram | null = null;
		try {
			program = createProgram(this.gl, textureVertexShaderSource, textureFragmentShaderSource, 'RGBA texture layer');
			this.pixelToClipLocation = requireUniform(this.gl, program, 'u_pixelToClip');
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
	}

	/** Uploads the overlay's RGBA8 pixels, reusing same-sized GPU storage. */
	uploadRgba8Texture(data: Uint8Array, width: number, height: number): void {
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
		gl.uniform2f(this.pixelToClipLocation, 2 / gl.drawingBufferWidth, -2 / gl.drawingBufferHeight);
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

	/** Deletes the texture drawer's WebGL resources. */
	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.releaseMemory();
		this.gl.deleteProgram(this.program);
		deleteRectangleGeometry(this.gl, this.geometry);
	}
}
