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
	uniform float u_alpha;

	out vec4 outColor;

	void main() {
		vec4 color = texture(u_texture, v_textureCoordinate);
		outColor = vec4(color.rgb * color.a, color.a) * u_alpha;
	}
`;

/** Filtering applied to one uploaded RGBA8 texture. */
export type RgbaTextureFilter = 'nearest' | 'linear';

/** CPU pixel arrays accepted by the RGBA texture uploader. */
export type RgbaTextureData = Uint8Array | Uint8ClampedArray;

/** Mutable handle for one GPU texture owned by an `RgbaTextureLayer`. */
export type RgbaTexture = {
	texture: WebGLTexture;
	width: number;
	height: number;
	filter: RgbaTextureFilter;
};

/** Options controlling creation or update of one RGBA8 texture. */
export type RgbaTextureUploadOptions = {
	/** Existing handle whose GPU object and storage should be reused. */
	texture?: RgbaTexture;
	/** Texture filtering; defaults to the existing filter or `nearest`. */
	filter?: RgbaTextureFilter;
};

/** Construction options for a fixed-phase RGBA texture layer. */
export type RgbaTextureLayerOptions = {
	/** Layer phase; defaults to `preDraw`, below all sprites. */
	phase?: 'preDraw' | 'postDraw';
};

/** Callback invoked from the configured hook so callers can update and draw current texture data. */
export type RgbaTextureLayerDrawCallback = (layer: RgbaTextureLayer) => void;

/** Uploads and draws caller-owned RGBA8 pixels in one fixed underlay or overlay phase. */
export class RgbaTextureLayer {
	private readonly gl: WebGL2RenderingContext;
	private readonly hooks: RenderPluginHost['hooks'];
	private readonly phase: 'preDraw' | 'postDraw';
	private readonly geometry: RectangleGeometry;
	private readonly program: WebGLProgram;
	private readonly resolutionLocation: WebGLUniformLocation;
	private readonly rectangleLocation: WebGLUniformLocation;
	private readonly textureLocation: WebGLUniformLocation;
	private readonly alphaLocation: WebGLUniformLocation;
	private readonly textures = new Set<RgbaTexture>();
	private readonly releasedTextures = new WeakSet<RgbaTexture>();
	private drawCallback: RgbaTextureLayerDrawCallback | null = null;
	private destroyed = false;

	/** Invokes the current layer callback from its configured render phase. */
	private readonly drawHook: RenderHook = () => {
		this.drawCallback?.(this);
	};

	/**
	 * Creates and attaches an initially empty fixed-phase texture layer.
	 *
	 * @param host - Engine or compatible render-plugin host.
	 * @param options - Layer phase configuration.
	 */
	constructor(host: RenderPluginHost, options: RgbaTextureLayerOptions = {}) {
		this.gl = host.gl;
		this.hooks = host.hooks;
		this.phase = options.phase ?? 'preDraw';
		const geometry = createRectangleGeometry(this.gl);
		let program: WebGLProgram | null = null;
		try {
			program = createProgram(this.gl, textureVertexShaderSource, textureFragmentShaderSource, 'RGBA texture layer');
			this.resolutionLocation = requireUniform(this.gl, program, 'u_resolution');
			this.rectangleLocation = requireUniform(this.gl, program, 'u_rectangle');
			this.textureLocation = requireUniform(this.gl, program, 'u_texture');
			this.alphaLocation = requireUniform(this.gl, program, 'u_alpha');
		} catch (error) {
			if (program) {
				this.gl.deleteProgram(program);
			}
			deleteRectangleGeometry(this.gl, geometry);
			throw error;
		}
		this.geometry = geometry;
		this.program = program;
		this.hooks[this.phase].push(this.drawHook);
	}

	/**
	 * Sets or clears the callback executed from the configured layer hook.
	 *
	 * @param callback - Per-frame texture update/draw callback, or `null` to disable layer work.
	 */
	setDrawCallback(callback: RgbaTextureLayerDrawCallback | null): void {
		this.drawCallback = callback;
	}

	/**
	 * Creates or updates one RGBA8 texture.
	 *
	 * Same-sized updates retain storage and use `texSubImage2D()`; dimension changes replace storage on the same handle.
	 *
	 * @param data - Straight-alpha RGBA8 pixel data in top-to-bottom row order.
	 * @param width - Positive texture width in pixels.
	 * @param height - Positive texture height in pixels.
	 * @param options - Existing handle and filter selection.
	 * @returns New or updated texture handle owned by this layer.
	 */
	uploadRgba8Texture(
		data: RgbaTextureData,
		width: number,
		height: number,
		options: RgbaTextureUploadOptions = {}
	): RgbaTexture {
		assertTextureInput(data, width, height);
		const gl = this.gl;
		const existing = options.texture;
		const filter = options.filter ?? existing?.filter ?? 'nearest';
		const existingTextureReleased = existing ? this.releasedTextures.delete(existing) : false;
		const texture =
			!existing || existingTextureReleased
				? requireResource(gl.createTexture(), 'RGBA8 layer texture')
				: existing.texture;
		const sizeChanged = !existing || existingTextureReleased || existing.width !== width || existing.height !== height;

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		applyTextureFilter(gl, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		if (sizeChanged) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
		} else {
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
		}

		if (existing) {
			existing.texture = texture;
			existing.width = width;
			existing.height = height;
			existing.filter = filter;
			return existing;
		}
		const handle = { texture, width, height, filter };
		this.textures.add(handle);
		return handle;
	}

	/**
	 * Immediately draws one texture rectangle in the plugin's current hook phase.
	 *
	 * This hot path intentionally does not validate handle ownership or numeric input.
	 *
	 * @param texture - Texture handle created by this layer.
	 * @param x - Destination X coordinate in canvas pixels.
	 * @param y - Destination Y coordinate in canvas pixels.
	 * @param width - Destination width; defaults to the texture width.
	 * @param height - Destination height; defaults to the texture height.
	 * @param alpha - Additional opacity multiplier; defaults to one.
	 */
	drawTexture(
		texture: RgbaTexture,
		x: number,
		y: number,
		width: number = texture.width,
		height: number = texture.height,
		alpha: number = 1
	): void {
		const gl = this.gl;
		prepareRenderPass(gl, this.program, this.geometry.vertexArray);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture.texture);
		gl.uniform1i(this.textureLocation, 0);
		gl.uniform2f(this.resolutionLocation, gl.drawingBufferWidth, gl.drawingBufferHeight);
		gl.uniform4f(this.rectangleLocation, x, y, width, height);
		gl.uniform1f(this.alphaLocation, alpha);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	/**
	 * Deletes one texture handle owned by this layer.
	 *
	 * @param texture - Handle to delete. Repeated deletion has no effect.
	 */
	deleteTexture(texture: RgbaTexture): void {
		if (this.textures.delete(texture)) {
			if (!this.releasedTextures.delete(texture)) {
				this.gl.deleteTexture(texture.texture);
			}
		}
	}

	/** Releases every uploaded texture while keeping handles valid for lazy reallocation on their next upload. */
	releaseMemory(): void {
		for (const texture of this.textures) {
			if (!this.releasedTextures.has(texture)) {
				this.gl.deleteTexture(texture.texture);
				this.releasedTextures.add(texture);
			}
		}
	}

	/** Detaches the hook and deletes every texture and WebGL resource owned by this plugin. */
	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		removeHook(this.hooks[this.phase], this.drawHook);
		for (const texture of this.textures) {
			if (!this.releasedTextures.delete(texture)) {
				this.gl.deleteTexture(texture.texture);
			}
		}
		this.textures.clear();
		this.gl.deleteProgram(this.program);
		deleteRectangleGeometry(this.gl, this.geometry);
		this.drawCallback = null;
	}
}

/**
 * Applies one explicit minification and magnification filter.
 *
 * @param gl - WebGL2 context whose bound texture is configured.
 * @param filter - Public nearest or linear filter name.
 */
function applyTextureFilter(gl: WebGL2RenderingContext, filter: RgbaTextureFilter): void {
	const glFilter = filter === 'linear' ? gl.LINEAR : gl.NEAREST;
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter);
}

/**
 * Validates cold RGBA upload dimensions and storage length.
 *
 * @param data - Pixel array to validate.
 * @param width - Requested texture width.
 * @param height - Requested texture height.
 */
function assertTextureInput(data: RgbaTextureData, width: number, height: number): void {
	if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
		throw new RangeError('RGBA8 texture dimensions must be positive integers.');
	}
	const requiredByteLength = width * height * 4;
	if (data.byteLength < requiredByteLength) {
		throw new RangeError(`RGBA8 texture data is too small: expected at least ${requiredByteLength} bytes.`);
	}
}
