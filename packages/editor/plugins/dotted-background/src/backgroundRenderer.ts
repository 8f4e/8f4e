import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { Font, FontAtlas } from '@8f4e/sprite-generator';
import { createProgram, prepareRenderPass, requireResource, requireUniform } from '@8f4e/web-ui';
import { BACKGROUND_DOTS } from './dot-settings';
import { fragmentShaderSource, vertexShaderSource } from './shaders';

type ViewportOrigin = Readonly<{ x: number; y: number }>;

/** Draws the editor's base and world-anchored dots without atlas masks or per-dot instance data. */
export default class BackgroundRenderer {
	private readonly program: WebGLProgram;
	private readonly vertexArray: WebGLVertexArrayObject;
	private readonly patternScaleLocation: WebGLUniformLocation;
	private readonly patternOffsetLocation: WebGLUniformLocation;
	private readonly dotBoundsLocation: WebGLUniformLocation;
	private readonly colorLocations: WebGLUniformLocation[];
	private readonly colors = [new Float32Array(4), new Float32Array(4), new Float32Array(4)];
	private readonly dotBounds = new Float32Array(4);
	private patternWidth = 1;
	private patternHeight = 1;
	private visible = false;
	private destroyed = false;

	constructor(private readonly gl: WebGL2RenderingContext) {
		const program = createProgram(gl, vertexShaderSource, fragmentShaderSource, 'background');
		let vertexArray: WebGLVertexArrayObject | null = null;
		try {
			vertexArray = requireResource(gl.createVertexArray(), 'background vertex array');
			this.patternScaleLocation = requireUniform(gl, program, 'u_patternScale');
			this.patternOffsetLocation = requireUniform(gl, program, 'u_patternOffset');
			this.dotBoundsLocation = requireUniform(gl, program, 'u_dotBounds');
			this.colorLocations = ['u_baseColor', 'u_evenColor', 'u_oddColor'].map(name => requireUniform(gl, program, name));
		} catch (error) {
			if (vertexArray) gl.deleteVertexArray(vertexArray);
			gl.deleteProgram(program);
			throw error;
		}
		this.program = program;
		this.vertexArray = vertexArray;
	}

	setFont(
		font: Font,
		{ cellWidth: characterWidth, cellHeight: characterHeight }: Pick<FontAtlas['grid'], 'cellWidth' | 'cellHeight'>
	): void {
		const backgroundDot = BACKGROUND_DOTS[font];
		this.patternWidth = characterWidth * 2;
		this.patternHeight = characterHeight;
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
	draw(origin: ViewportOrigin): void {
		if (!this.visible) return;
		const gl = this.gl;
		// Establish the WebGL state this pass needs independently of other layers.
		prepareRenderPass(gl, this.program, this.vertexArray);
		// Wrap before uploading so large world coordinates retain pixel precision and column parity.
		gl.uniform2f(
			this.patternOffsetLocation,
			(origin.x % this.patternWidth) / this.patternWidth,
			(origin.y % this.patternHeight) / this.patternHeight
		);
		gl.uniform2f(
			this.patternScaleLocation,
			gl.drawingBufferWidth / this.patternWidth,
			gl.drawingBufferHeight / this.patternHeight
		);
		gl.uniform4fv(this.dotBoundsLocation, this.dotBounds);
		for (let index = 0; index < this.colors.length; index++)
			gl.uniform4fv(this.colorLocations[index], this.colors[index]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.gl.deleteVertexArray(this.vertexArray);
		this.gl.deleteProgram(this.program);
	}
}
