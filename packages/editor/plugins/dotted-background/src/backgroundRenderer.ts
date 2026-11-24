import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createProgram, prepareRenderPass, requireResource, requireUniform } from '@8f4e/web-ui';
import { fragmentShaderSource, vertexShaderSource } from './shaders';

type ViewportGrid = Readonly<{ x: number; y: number; vGrid: number; hGrid: number }>;

/** Draws the editor's base and world-anchored dots without atlas masks or per-dot instance data. */
export default class BackgroundRenderer {
	private readonly program: WebGLProgram;
	private readonly vertexArray: WebGLVertexArrayObject;
	private readonly patternScaleLocation: WebGLUniformLocation;
	private readonly patternOffsetLocation: WebGLUniformLocation;
	private readonly dotBoundsLocation: WebGLUniformLocation;
	private readonly colorLocations: WebGLUniformLocation[];
	private readonly colors = [new Float32Array(4), new Float32Array(4), new Float32Array(4)];
	private uploadedVGrid?: number;
	private uploadedHGrid?: number;
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
	draw({ x, y, vGrid, hGrid }: ViewportGrid): void {
		if (!this.visible) return;
		const gl = this.gl;
		const patternWidth = vGrid * 2;
		// Establish the WebGL state this pass needs independently of other layers.
		prepareRenderPass(gl, this.program, this.vertexArray);
		// Wrap before uploading so large world coordinates retain pixel precision and column parity.
		gl.uniform2f(this.patternOffsetLocation, (x % patternWidth) / patternWidth, (y % hGrid) / hGrid);
		gl.uniform2f(this.patternScaleLocation, gl.drawingBufferWidth / patternWidth, gl.drawingBufferHeight / hGrid);
		if (vGrid !== this.uploadedVGrid || hGrid !== this.uploadedHGrid) {
			const size = Math.max(1, Math.round(Math.min(vGrid, hGrid) / 4));
			const dotX = Math.floor((vGrid - size) / 2);
			const dotY = Math.floor((hGrid - size) / 2);
			gl.uniform4f(this.dotBoundsLocation, dotX / vGrid, dotY / hGrid, (dotX + size) / vGrid, (dotY + size) / hGrid);
			this.uploadedVGrid = vGrid;
			this.uploadedHGrid = hGrid;
		}
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
