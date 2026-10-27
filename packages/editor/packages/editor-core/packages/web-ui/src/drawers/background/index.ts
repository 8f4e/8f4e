import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { SpriteData } from '@8f4e/sprite-generator';
import type { RenderHook, RenderPluginHost } from 'glugglugglug';
import { fragmentShaderSource, vertexShaderSource } from './shaders';

/** Draws the editor's base and alternating dots without atlas masks or per-dot instance data. */
export default class BackgroundRenderer {
	private readonly program: WebGLProgram;
	private readonly vertexArray: WebGLVertexArrayObject;
	private readonly patternScaleLocation: WebGLUniformLocation;
	private readonly dotBoundsLocation: WebGLUniformLocation;
	private readonly firstLayerLocation: WebGLUniformLocation;
	private readonly colorLocations: WebGLUniformLocation[];
	private readonly colors = [new Float32Array(4), new Float32Array(4), new Float32Array(4)];
	private readonly dotBounds = new Float32Array(4);
	private inversePatternWidth = 0;
	private inversePatternHeight = 0;
	private firstLayer = 0;
	private layerCount = 0;
	private destroyed = false;
	private readonly drawHook: RenderHook = () => this.draw();

	constructor(private readonly host: RenderPluginHost) {
		const gl = host.gl;
		const program = createProgram(gl);
		let vertexArray: WebGLVertexArrayObject | null = null;
		try {
			vertexArray = requireResource(gl.createVertexArray(), 'background vertex array');
			this.patternScaleLocation = requireUniform(gl, program, 'u_patternScale');
			this.dotBoundsLocation = requireUniform(gl, program, 'u_dotBounds');
			this.firstLayerLocation = requireUniform(gl, program, 'u_firstLayer');
			this.colorLocations = ['u_baseColor', 'u_evenColor', 'u_oddColor'].map(name => requireUniform(gl, program, name));
		} catch (error) {
			if (vertexArray) gl.deleteVertexArray(vertexArray);
			gl.deleteProgram(program);
			throw error;
		}
		this.program = program;
		this.vertexArray = vertexArray;
		host.hooks.preDraw.push(this.drawHook);
	}

	setFont({
		characterWidth,
		characterHeight,
		backgroundDot,
	}: Pick<SpriteData, 'characterWidth' | 'characterHeight' | 'backgroundDot'>): void {
		this.inversePatternWidth = 1 / (characterWidth * 2);
		this.inversePatternHeight = 1 / characterHeight;
		this.dotBounds.set([
			backgroundDot.x / characterWidth,
			backgroundDot.y / characterHeight,
			(backgroundDot.x + backgroundDot.size) / characterWidth,
			(backgroundDot.y + backgroundDot.size) / characterHeight,
		]);
	}

	/** Match the sprite renderer's RGBA8 quantization and premultiplied float32 palette upload. */
	setPalette(bytes: Uint8Array): void {
		for (const [index, token] of (['canvasBase', 'canvasDetail2', 'canvasDetail1'] as const).entries()) {
			const offset = PALETTE_INDICES[token] * 4;
			const color = this.colors[index];
			const alpha = Math.fround(bytes[offset + 3] / 255);
			color[0] = Math.fround(bytes[offset] / 255) * alpha;
			color[1] = Math.fround(bytes[offset + 1] / 255) * alpha;
			color[2] = Math.fround(bytes[offset + 2] / 255) * alpha;
			color[3] = alpha;
		}
		const baseVisible = this.colors[0][3] !== 0;
		const dotsVisible = this.colors[1][3] !== 0 || this.colors[2][3] !== 0;
		this.firstLayer = baseVisible ? 0 : 1;
		this.layerCount = Number(baseVisible) + Number(dotsVisible);
	}

	/** Programs and the empty VAO have no reloadable storage and survive rendering-memory release. */
	private draw(): void {
		if (this.layerCount === 0) return;
		const gl = this.host.gl;
		// The background shares the raw context with render hooks; establish every state needed by this pass.
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		gl.useProgram(this.program);
		gl.bindVertexArray(this.vertexArray);
		gl.enable(gl.BLEND);
		gl.blendEquation(gl.FUNC_ADD);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.colorMask(true, true, true, true);
		gl.disable(gl.SCISSOR_TEST);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.STENCIL_TEST);
		gl.disable(gl.CULL_FACE);
		gl.disable(gl.RASTERIZER_DISCARD);
		gl.uniform2f(
			this.patternScaleLocation,
			gl.drawingBufferWidth * this.inversePatternWidth,
			gl.drawingBufferHeight * this.inversePatternHeight
		);
		gl.uniform4fv(this.dotBoundsLocation, this.dotBounds);
		gl.uniform1ui(this.firstLayerLocation, this.firstLayer);
		for (let index = 0; index < this.colors.length; index++)
			gl.uniform4fv(this.colorLocations[index], this.colors[index]);
		// Separate ordered instances preserve the base-fill quantization and translucent dot blending.
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, this.layerCount);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		const index = this.host.hooks.preDraw.indexOf(this.drawHook);
		if (index !== -1) this.host.hooks.preDraw.splice(index, 1);
		this.host.gl.deleteVertexArray(this.vertexArray);
		this.host.gl.deleteProgram(this.program);
	}
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
	const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	let fragment: WebGLShader | null = null;
	let program: WebGLProgram | null = null;
	try {
		fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
		program = requireResource(gl.createProgram(), 'background program');
		gl.attachShader(program, vertex);
		gl.attachShader(program, fragment);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) ?? 'Could not link the background program.');
		}
		return program;
	} catch (error) {
		if (program) gl.deleteProgram(program);
		throw error;
	} finally {
		gl.deleteShader(vertex);
		if (fragment) gl.deleteShader(fragment);
	}
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = requireResource(gl.createShader(type), 'background shader');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) ?? 'Could not compile a background shader.';
		gl.deleteShader(shader);
		throw new Error(message);
	}
	return shader;
}

function requireResource<T>(resource: T | null, name: string): T {
	if (resource === null) throw new Error(`Could not create the ${name}.`);
	return resource;
}

function requireUniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
	const location = gl.getUniformLocation(program, name);
	if (location === null) throw new Error(`Could not find the ${name} background uniform.`);
	return location;
}
