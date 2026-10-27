import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { SpriteData } from '@8f4e/sprite-generator';
import type { RenderHook, RenderPluginHost } from 'glugglugglug';
import { createProgram, prepareRenderPass, removeHook, requireResource, requireUniform } from '../webgl';
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
		const program = createProgram(gl, vertexShaderSource, fragmentShaderSource, 'background');
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
		prepareRenderPass(gl, this.program, this.vertexArray);
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
		removeHook(this.host.hooks.preDraw, this.drawHook);
		this.host.gl.deleteVertexArray(this.vertexArray);
		this.host.gl.deleteProgram(this.program);
	}
}
