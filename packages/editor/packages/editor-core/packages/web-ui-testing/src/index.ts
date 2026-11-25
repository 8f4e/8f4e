import { FILL_SPRITE_ID } from '@8f4e/sprite-generator';
import type { RenderHooks, SpriteAtlasGrid, SpriteAtlasImage } from 'glugglugglug';

/** A sprite-only snapshot target; shaders, wires, and font bitmap details are not rendered. */
export class AsciiRenderer {
	private readonly gpu;
	readonly gl: WebGL2RenderingContext;
	readonly hooks: RenderHooks = { preDraw: [], postDraw: [] };
	readonly frameStats = { spriteCount: 0, uploadedInstanceBytes: 0 };
	private cellWidth = 1;
	private cellHeight = 1;
	private palette = new Uint8Array(0);
	private cells: string[][] = [];
	private columns = 0;

	constructor(width: number, height: number) {
		this.gpu = createNoOpGpu(width, height);
		// Only the background and wire methods used by test scenes are implemented.
		this.gl = this.gpu as unknown as WebGL2RenderingContext;
	}

	setSpriteAtlas(_image: SpriteAtlasImage, grid: SpriteAtlasGrid): void {
		this.cellWidth = grid.cellWidth;
		this.cellHeight = grid.cellHeight;
	}

	setPalette(colors: Uint8Array): void {
		this.palette = colors.slice();
	}

	resize(width: number, height: number): void {
		this.gpu.drawingBufferWidth = width;
		this.gpu.drawingBufferHeight = height;
	}

	renderFrame(submit: () => void): void {
		this.columns = cellEdge(this.gl.drawingBufferWidth, this.cellWidth);
		const rows = cellEdge(this.gl.drawingBufferHeight, this.cellHeight);
		this.cells = Array.from({ length: rows }, () => new Array<string>(this.columns).fill(' '));
		this.frameStats.spriteCount = 0;
		for (const hook of this.hooks.preDraw) hook(this.gl);
		submit();
		for (const hook of this.hooks.postDraw) hook(this.gl);
	}

	/** A visible fill erases cells; a space glyph or zero-alpha sprite leaves existing cells intact. */
	drawSprite(
		x: number,
		y: number,
		spriteId: number,
		color: number,
		width = this.cellWidth,
		height = this.cellHeight
	): void {
		this.frameStats.spriteCount++;
		if (spriteId === 32 || !this.palette[color * 4 + 3]) return;
		const glyph =
			spriteId === FILL_SPRITE_ID ? ' ' : spriteId > 32 && spriteId < 127 ? String.fromCharCode(spriteId) : '?';
		const left = Math.max(0, cellEdge(x, this.cellWidth));
		const right = Math.min(this.columns, cellEdge(x + width, this.cellWidth));
		if (left >= right) return;
		const top = Math.max(0, cellEdge(y, this.cellHeight));
		const bottom = Math.min(this.cells.length, cellEdge(y + height, this.cellHeight));
		for (let row = top; row < bottom; row++) this.cells[row].fill(glyph, left, right);
	}

	/** Retains the fixed width of each row, including trailing spaces. */
	toText(): string {
		return this.cells.map(row => row.join('')).join('\n');
	}

	releaseRenderingMemory(): void {}
	restoreRenderingMemory(): void {}
	destroy(): void {
		this.cells = [];
		this.hooks.preDraw.length = 0;
		this.hooks.postDraw.length = 0;
	}
}

const canvasRenderers = new WeakMap<HTMLCanvasElement, AsciiRenderer>();

/** Keep the real canvas for focus, input, and resize behavior without painting into it. */
export function createAsciiCanvasRenderer(canvas: HTMLCanvasElement): AsciiRenderer {
	class CanvasRenderer extends AsciiRenderer {
		override resize(width: number, height: number): void {
			super.resize(width, height);
			canvas.width = width;
			canvas.height = height;
		}
	}
	const renderer = new CanvasRenderer(canvas.width, canvas.height);
	canvasRenderers.set(canvas, renderer);
	return renderer;
}

/** Read the full frame last submitted for a canvas backed by the test renderer. */
export function readAsciiViewport(canvas: HTMLCanvasElement): string {
	const renderer = canvasRenderers.get(canvas);
	if (!renderer) throw new Error('The canvas does not have an ASCII renderer.');
	return `${renderer.toText()}\n`;
}

/** Index of the first cell whose center is on or after the given pixel edge. */
function cellEdge(pixel: number, cellSize: number): number {
	return Math.ceil(pixel / cellSize - 0.5);
}

function createNoOpGpu(drawingBufferWidth: number, drawingBufferHeight: number) {
	const noop = () => {};
	const resource = () => ({});
	return {
		drawingBufferWidth,
		drawingBufferHeight,
		VERTEX_SHADER: 0x8b31,
		FRAGMENT_SHADER: 0x8b30,
		COMPILE_STATUS: 0x8b81,
		LINK_STATUS: 0x8b82,
		FRAMEBUFFER: 0x8d40,
		SCISSOR_TEST: 0x0c11,
		DEPTH_TEST: 0x0b71,
		STENCIL_TEST: 0x0b90,
		CULL_FACE: 0x0b44,
		RASTERIZER_DISCARD: 0x8c89,
		BLEND: 0x0be2,
		FUNC_ADD: 0x8006,
		ONE: 1,
		ONE_MINUS_SRC_ALPHA: 0x0303,
		TRIANGLES: 0x0004,
		TRIANGLE_STRIP: 0x0005,
		ARRAY_BUFFER: 0x8892,
		DYNAMIC_DRAW: 0x88e8,
		FLOAT: 0x1406,
		UNSIGNED_BYTE: 0x1401,
		createShader: resource,
		shaderSource: noop,
		compileShader: noop,
		getShaderParameter: () => true,
		deleteShader: noop,
		createProgram: resource,
		attachShader: noop,
		linkProgram: noop,
		getProgramParameter: () => true,
		deleteProgram: noop,
		createVertexArray: resource,
		deleteVertexArray: noop,
		getUniformLocation: resource,
		bindFramebuffer: noop,
		viewport: noop,
		useProgram: noop,
		bindVertexArray: noop,
		colorMask: noop,
		disable: noop,
		enable: noop,
		blendEquation: noop,
		blendFunc: noop,
		uniform2f: noop,
		uniform4f: noop,
		uniform4fv: noop,
		drawArrays: noop,
		createBuffer: resource,
		deleteBuffer: noop,
		bindBuffer: noop,
		bufferData: noop,
		bufferSubData: noop,
		enableVertexAttribArray: noop,
		vertexAttribPointer: noop,
		vertexAttribDivisor: noop,
		drawArraysInstanced: noop,
	};
}
