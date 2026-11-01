import { createProgram, prepareRenderPass, requireResource, requireUniform } from '@8f4e/web-ui';
import { LINE_INSTANCE_BYTE_STRIDE, LINE_INSTANCE_LAYOUT, type LineColor } from './line-instance';
import { LineInstanceBuffer } from './line-instance-buffer';
import { lineFragmentShaderSource, lineVertexShaderSource } from './line-shaders';

const DEFAULT_INITIAL_CAPACITY = 1_024;

/**
 * Plugin-owned renderer that batches Bresenham pixel lines above all sprites.
 *
 * The connectors plugin resets, fills, and flushes one reusable buffer per pass.
 * It owns all GPU resources and releases them through the editor render-layer lifecycle.
 */
export class LineDrawer {
	private readonly lines: LineInstanceBuffer;
	private readonly program: WebGLProgram;
	private readonly buffer: WebGLBuffer;
	private readonly vertexArray: WebGLVertexArrayObject;
	private readonly pixelToClipLocation: WebGLUniformLocation;
	private gpuCapacity: number;
	private destroyed = false;

	/** Start a new wire pass without reallocating the retained buffer. */
	reset(): void {
		this.lines.reset();
	}

	/**
	 * Creates the wire renderer on the editor WebGL context.
	 *
	 * @param gl - Shared WebGL context.
	 * @param initialCapacity - Number of line instances retained before the buffer grows.
	 */
	constructor(
		private readonly gl: WebGL2RenderingContext,
		initialCapacity = DEFAULT_INITIAL_CAPACITY
	) {
		this.lines = new LineInstanceBuffer(initialCapacity);
		this.gpuCapacity = this.lines.capacity;

		const resources = createLineResources(this.gl);
		this.program = resources.program;
		this.buffer = resources.buffer;
		this.vertexArray = resources.vertexArray;
		this.pixelToClipLocation = resources.pixelToClipLocation;

		gl.bindVertexArray(this.vertexArray);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.gpuCapacity * LINE_INSTANCE_BYTE_STRIDE, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, LINE_INSTANCE_BYTE_STRIDE, LINE_INSTANCE_LAYOUT.x1);
		gl.vertexAttribDivisor(0, 1);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 1, gl.FLOAT, false, LINE_INSTANCE_BYTE_STRIDE, LINE_INSTANCE_LAYOUT.thickness);
		gl.vertexAttribDivisor(1, 1);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, LINE_INSTANCE_BYTE_STRIDE, LINE_INSTANCE_LAYOUT.color);
		gl.vertexAttribDivisor(2, 1);
	}

	/**
	 * Appends one line to this frame's reusable instance buffer.
	 *
	 * Lines are drawn in call order above every sprite. Invalid coordinates,
	 * colors, or lifecycle calls are programmer errors with unspecified consequences.
	 * Endpoints snap to the nearest pixel and are both included. Thickness must be
	 * a positive integer and expands along the minor axis of the staircase.
	 *
	 * @param x1 - Starting X coordinate in canvas pixels.
	 * @param y1 - Starting Y coordinate in canvas pixels.
	 * @param x2 - Ending X coordinate in canvas pixels.
	 * @param y2 - Ending Y coordinate in canvas pixels.
	 * @param thickness - Positive integer thickness in canvas pixels.
	 * @param color - Normalized red, green, blue, and alpha components.
	 */
	drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: LineColor): void {
		this.lines.append(x1, y1, x2, y2, thickness, color);
	}

	/** Releases retained dynamic GPU buffer storage while preserving the buffer object and shader state. */
	releaseMemory(): void {
		if (this.destroyed || this.gpuCapacity === 0) {
			return;
		}
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, 0, this.gl.DYNAMIC_DRAW);
		this.gpuCapacity = 0;
	}

	/**
	 * Releases every WebGL resource owned by this renderer.
	 *
	 * Calling this method more than once has no effect.
	 */
	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.gl.deleteBuffer(this.buffer);
		this.gl.deleteVertexArray(this.vertexArray);
		this.gl.deleteProgram(this.program);
	}

	/** Uploads the used instance range and draws every queued line in one call. */
	flush(): void {
		if (this.lines.count === 0) {
			return;
		}

		const gl = this.gl;
		prepareRenderPass(gl, this.program, this.vertexArray);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

		if (this.lines.capacity > this.gpuCapacity) {
			this.gpuCapacity = this.lines.capacity;
			gl.bufferData(gl.ARRAY_BUFFER, this.gpuCapacity * LINE_INSTANCE_BYTE_STRIDE, gl.DYNAMIC_DRAW);
		}
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lines.fullBytes, 0, this.lines.usedByteLength);
		gl.uniform2f(this.pixelToClipLocation, 2 / gl.drawingBufferWidth, -2 / gl.drawingBufferHeight);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.lines.count);
	}
}

/**
 * Allocates the program, buffer, vertex array, and uniform used by the line plugin.
 *
 * @param gl - WebGL2 context that owns the new resources.
 * @returns Fully allocated line-rendering resources.
 */
function createLineResources(gl: WebGL2RenderingContext): {
	program: WebGLProgram;
	buffer: WebGLBuffer;
	vertexArray: WebGLVertexArrayObject;
	pixelToClipLocation: WebGLUniformLocation;
} {
	const program = createProgram(gl, lineVertexShaderSource, lineFragmentShaderSource, 'line');
	let buffer: WebGLBuffer | null = null;
	let vertexArray: WebGLVertexArrayObject | null = null;
	try {
		buffer = requireResource(gl.createBuffer(), 'line instance buffer');
		vertexArray = requireResource(gl.createVertexArray(), 'line vertex array');
		return {
			program,
			buffer,
			vertexArray,
			pixelToClipLocation: requireUniform(gl, program, 'u_pixelToClip'),
		};
	} catch (error) {
		if (buffer) {
			gl.deleteBuffer(buffer);
		}
		if (vertexArray) {
			gl.deleteVertexArray(vertexArray);
		}
		gl.deleteProgram(program);
		throw error;
	}
}
