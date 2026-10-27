import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { Font } from '@8f4e/sprite-generator';
import type { RenderHook, RenderPluginHost, SpriteAtlasGrid } from 'glugglugglug';
import { createProgram, prepareRenderPass, removeHook, requireResource, requireUniform } from '../webgl';
import { BACKGROUND_DOTS } from './dot-settings';
import { fragmentShaderSource, vertexShaderSource } from './shaders';

/** Draws the editor's base and alternating dots without atlas masks or per-dot instance data. */
export default class BackgroundRenderer {
	private readonly program: WebGLProgram;
	private readonly vertexArray: WebGLVertexArrayObject;
	private readonly patternScaleLocation: WebGLUniformLocation;
	private readonly dotBoundsLocation: WebGLUniformLocation;
	private readonly colorLocations: WebGLUniformLocation[];
	private readonly colors = [new Float32Array(4), new Float32Array(4), new Float32Array(4)];
	private readonly dotBounds = new Float32Array(4);
	private inversePatternWidth = 0;
	private inversePatternHeight = 0;
	private visible = false;
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

	setFont(
		font: Font,
		{ cellWidth: characterWidth, cellHeight: characterHeight }: Pick<SpriteAtlasGrid, 'cellWidth' | 'cellHeight'>
	): void {
		const backgroundDot = BACKGROUND_DOTS[font];
		this.inversePatternWidth = 1 / (characterWidth * 2);
		this.inversePatternHeight = 1 / characterHeight;
		this.dotBounds.set([
			backgroundDot.x / characterWidth,
			backgroundDot.y / characterHeight,
			(backgroundDot.x + backgroundDot.size) / characterWidth,
			(backgroundDot.y + backgroundDot.size) / characterHeight,
		]);
	}

	/** Prepare premultiplied colors, compositing each dot color over the base once per palette change. */
	setPalette(bytes: Uint8Array): void {
		for (const [index, token] of (['canvasBase', 'canvasDetail2', 'canvasDetail1'] as const).entries()) {
			const offset = PALETTE_INDICES[token] * 4;
			const color = this.colors[index];
			const alpha = bytes[offset + 3] / 255;
			color[0] = (bytes[offset] / 255) * alpha;
			color[1] = (bytes[offset + 1] / 255) * alpha;
			color[2] = (bytes[offset + 2] / 255) * alpha;
			color[3] = alpha;
		}
		for (const color of this.colors.slice(1)) {
			const remaining = 1 - color[3];
			for (let channel = 0; channel < 4; channel++) color[channel] += this.colors[0][channel] * remaining;
		}
		this.visible = this.colors.some(color => color[3] !== 0);
	}

	/** Programs and the empty VAO have no reloadable storage and survive rendering-memory release. */
	private draw(): void {
		if (!this.visible) return;
		const gl = this.host.gl;
		// The background shares the raw context with render hooks; establish every state needed by this pass.
		prepareRenderPass(gl, this.program, this.vertexArray);
		gl.uniform2f(
			this.patternScaleLocation,
			gl.drawingBufferWidth * this.inversePatternWidth,
			gl.drawingBufferHeight * this.inversePatternHeight
		);
		gl.uniform4fv(this.dotBoundsLocation, this.dotBounds);
		for (let index = 0; index < this.colors.length; index++)
			gl.uniform4fv(this.colorLocations[index], this.colors[index]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		removeHook(this.host.hooks.preDraw, this.drawHook);
		this.host.gl.deleteVertexArray(this.vertexArray);
		this.host.gl.deleteProgram(this.program);
	}
}
