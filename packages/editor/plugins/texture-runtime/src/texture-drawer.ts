import { createProgram, prepareRenderPass, requireResource, requireUniform } from '@8f4e/web-ui';
import type { TextureFormat } from './directive';
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
	precision highp float;
	precision highp int;

	in vec2 v_textureCoordinate;
	uniform sampler2D u_texture;
	uniform int u_format;
	uniform vec2 u_sourceSize;

	out vec4 outColor;

	void main() {
		ivec2 pixel = min(ivec2(v_textureCoordinate * u_sourceSize), ivec2(u_sourceSize) - 1);
		vec4 color;
		if (u_format == 0) {
			uint packed = uint(round(texelFetch(u_texture, ivec2(pixel.x / 8, pixel.y), 0).r * 255.0));
			float value = float((packed >> uint(7 - pixel.x % 8)) & 1u);
			color = vec4(vec3(value), 1.0);
		} else {
			color = texelFetch(u_texture, pixel, 0);
			if (u_format == 1) color = vec4(vec3(color.r), 1.0);
		}
		outColor = vec4(color.rgb * color.a, color.a);
	}
`;

const FORMAT_IDS = { '1bit': 0, mono: 1, rgb: 2, rgba: 3 };

interface TextureStorage {
	texture: WebGLTexture;
	width: number;
	height: number;
	format: TextureFormat;
}

/** One shader program and rectangle shared by all framebuffer views in an editor. */
export class TextureDrawer {
	private readonly gl: WebGL2RenderingContext;
	private readonly geometry: RectangleGeometry;
	private readonly program: WebGLProgram;
	private readonly pixelToClipLocation: WebGLUniformLocation;
	private readonly rectangleLocation: WebGLUniformLocation;
	private readonly textureLocation: WebGLUniformLocation;
	private readonly formatLocation: WebGLUniformLocation;
	private readonly sourceSizeLocation: WebGLUniformLocation;
	private readonly textures = new Map<string, TextureStorage>();

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
			program = createProgram(this.gl, textureVertexShaderSource, textureFragmentShaderSource, 'texture directives');
			this.pixelToClipLocation = requireUniform(this.gl, program, 'u_pixelToClip');
			this.rectangleLocation = requireUniform(this.gl, program, 'u_rectangle');
			this.textureLocation = requireUniform(this.gl, program, 'u_texture');
			this.formatLocation = requireUniform(this.gl, program, 'u_format');
			this.sourceSizeLocation = requireUniform(this.gl, program, 'u_sourceSize');
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

	/** Uploads source bytes directly, retaining independent storage for each directive. */
	upload(key: string, data: Uint8Array, width: number, height: number, format: TextureFormat): void {
		const gl = this.gl;
		const previous = this.textures.get(key);
		const texture = previous?.texture ?? requireResource(gl.createTexture(), 'framebuffer texture');
		const sizeChanged =
			!previous || previous.width !== width || previous.height !== height || previous.format !== format;
		const uploadWidth = format === '1bit' ? Math.ceil(width / 8) : width;
		const externalFormat = format === 'rgba' ? gl.RGBA : format === 'rgb' ? gl.RGB : gl.RED;
		const internalFormat = format === 'rgba' ? gl.RGBA8 : format === 'rgb' ? gl.RGB8 : gl.R8;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
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
			gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, uploadWidth, height, 0, externalFormat, gl.UNSIGNED_BYTE, data);
			this.textures.set(key, { texture, width, height, format });
		} else {
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, uploadWidth, height, externalFormat, gl.UNSIGNED_BYTE, data);
		}
	}

	/** Draws a source texture with nearest sampling and premultiplied-alpha output. */
	drawTexture(key: string, x: number, y: number, width: number, height: number): void {
		const gl = this.gl;
		const source = this.textures.get(key)!;
		prepareRenderPass(gl, this.program, this.geometry.vertexArray);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, source.texture);
		gl.bindSampler(0, null);
		gl.uniform1i(this.textureLocation, 0);
		gl.uniform1i(this.formatLocation, FORMAT_IDS[source.format]);
		gl.uniform2f(this.sourceSizeLocation, source.width, source.height);
		gl.uniform2f(this.pixelToClipLocation, 2 / gl.drawingBufferWidth, -2 / gl.drawingBufferHeight);
		gl.uniform4f(this.rectangleLocation, x, y, width, height);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	/** Frees storage for directives removed from the current view or scrolled offscreen. */
	retainTextures(keys: ReadonlySet<string>): void {
		for (const [key, source] of this.textures) {
			if (!keys.has(key)) {
				this.gl.deleteTexture(source.texture);
				this.textures.delete(key);
			}
		}
	}

	/** Releases pixel storage; later uploads recreate it using the same program and geometry. */
	releaseMemory(): void {
		for (const source of this.textures.values()) this.gl.deleteTexture(source.texture);
		this.textures.clear();
	}

	/** Deletes the texture drawer's WebGL resources. */
	destroy(): void {
		this.releaseMemory();
		this.gl.deleteProgram(this.program);
		deleteRectangleGeometry(this.gl, this.geometry);
	}
}
