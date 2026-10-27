import type { RenderHook, RenderPluginHost } from 'glugglugglug';
import { createProgram, prepareRenderPass, removeHook, requireResource, requireUniform } from '../webgl';
import { LINE_INSTANCE_BYTE_STRIDE, LineInstanceBuffer } from './line-instance-buffer';
import { lineFragmentShaderSource, lineVertexShaderSource } from './line-shaders';

const DEFAULT_INITIAL_CAPACITY = 1_024;

/** Normalized red, green, blue, and alpha components for one line. */
export type LineColor = readonly [red: number, green: number, blue: number, alpha: number];

/** Construction options for a line-drawer plugin. */
export type LineDrawerOptions = {
	/** Initial number of line instances retained by the CPU and GPU buffers. */
	initialCapacity?: number;
};

/**
 * Editor-owned render-hook plugin that batches solid pixel lines above all sprites.
 *
 * The plugin registers one pre-draw hook to reset its reusable CPU buffer and
 * one post-draw hook to upload and render the submitted lines. It owns its GPU
 * resources; callers must invoke `destroy()` independently of `Engine.destroy()`.
 */
export class LineDrawer {
	private readonly gl: WebGL2RenderingContext;
	private readonly hooks: RenderPluginHost['hooks'];
	private readonly lines: LineInstanceBuffer;
	private readonly program: WebGLProgram;
	private readonly buffer: WebGLBuffer;
	private readonly vertexArray: WebGLVertexArrayObject;
	private readonly resolutionLocation: WebGLUniformLocation;
	private gpuCapacity: number;
	private destroyed = false;

	/** Resets retained line storage before application drawing begins. */
	private readonly resetHook: RenderHook = () => {
		this.lines.reset();
	};

	/** Uploads and draws queued lines after the engine's sprite pass. */
	private readonly flushHook: RenderHook = () => {
		this.flush();
	};

	/**
	 * Creates and attaches a line overlay to a render-hook host.
	 *
	 * @param host - Engine or compatible host whose context and hooks receive the line pass.
	 * @param options - Optional initial line-buffer configuration.
	 */
	constructor(host: RenderPluginHost, options: LineDrawerOptions = {}) {
		this.gl = host.gl;
		this.hooks = host.hooks;
		this.lines = new LineInstanceBuffer(options.initialCapacity ?? DEFAULT_INITIAL_CAPACITY);
		this.gpuCapacity = this.lines.capacity;

		const resources = createLineResources(this.gl);
		this.program = resources.program;
		this.buffer = resources.buffer;
		this.vertexArray = resources.vertexArray;
		this.resolutionLocation = resources.resolutionLocation;

		const gl = this.gl;
		gl.bindVertexArray(this.vertexArray);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.gpuCapacity * LINE_INSTANCE_BYTE_STRIDE, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, LINE_INSTANCE_BYTE_STRIDE, 0);
		gl.vertexAttribDivisor(0, 1);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 1, gl.FLOAT, false, LINE_INSTANCE_BYTE_STRIDE, 4 * Float32Array.BYTES_PER_ELEMENT);
		gl.vertexAttribDivisor(1, 1);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, LINE_INSTANCE_BYTE_STRIDE, 5 * Float32Array.BYTES_PER_ELEMENT);
		gl.vertexAttribDivisor(2, 1);

		this.hooks.preDraw.push(this.resetHook);
		this.hooks.postDraw.push(this.flushHook);
	}

	/**
	 * Appends one unchecked line to this frame's reusable instance buffer.
	 *
	 * Lines are drawn in call order above every sprite. Invalid coordinates,
	 * thicknesses, colors, or lifecycle calls are programmer errors with
	 * unspecified consequences.
	 *
	 * @param x1 - Starting X coordinate in canvas pixels.
	 * @param y1 - Starting Y coordinate in canvas pixels.
	 * @param x2 - Ending X coordinate in canvas pixels.
	 * @param y2 - Ending Y coordinate in canvas pixels.
	 * @param thickness - Full line thickness in canvas pixels.
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
	 * Detaches this plugin and releases every WebGL resource it owns.
	 *
	 * Calling this method more than once has no effect.
	 */
	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		removeHook(this.hooks.preDraw, this.resetHook);
		removeHook(this.hooks.postDraw, this.flushHook);
		this.gl.deleteBuffer(this.buffer);
		this.gl.deleteVertexArray(this.vertexArray);
		this.gl.deleteProgram(this.program);
	}

	/** Uploads the used instance range and draws every queued line in one call. */
	private flush(): void {
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
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lines.usedBytes());
		gl.uniform2f(this.resolutionLocation, gl.drawingBufferWidth, gl.drawingBufferHeight);
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
	resolutionLocation: WebGLUniformLocation;
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
			resolutionLocation: requireUniform(gl, program, 'u_resolution'),
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
