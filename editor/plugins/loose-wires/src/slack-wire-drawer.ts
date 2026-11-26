import { createProgram, prepareRenderPass, requireResource, requireUniform } from '@8f4e/web-ui';
import { SLACK_WIRE_VERTEX_COUNT, slackWireFragmentShader, slackWireVertexShader } from './slack-wire-shaders';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const INSTANCE_FLOATS = 9;
const STRIDE = INSTANCE_FLOATS * FLOAT_BYTES;
type WireColor = readonly [number, number, number, number];

/** Batches endpoints, width and color. The shader generates all slack wire geometry. */
export function createSlackWireDrawer(gl: WebGL2RenderingContext) {
	const program = createProgram(gl, slackWireVertexShader, slackWireFragmentShader, 'slack wires');
	let buffer: WebGLBuffer | undefined;
	let vertexArray: WebGLVertexArrayObject | undefined;
	try {
		const instanceBuffer = (buffer = requireResource(gl.createBuffer(), 'slack wire instance buffer'));
		const vao = (vertexArray = requireResource(gl.createVertexArray(), 'slack wire vertex array'));
		const pixelToClip = requireUniform(gl, program, 'u_pixelToClip');
		const slackUniform = requireUniform(gl, program, 'u_slack');
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, STRIDE, 0);
		gl.vertexAttribDivisor(0, 1);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 1, gl.FLOAT, false, STRIDE, 4 * FLOAT_BYTES);
		gl.vertexAttribDivisor(1, 1);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE, 5 * FLOAT_BYTES);
		gl.vertexAttribDivisor(2, 1);

		let instances = new Float32Array(256 * INSTANCE_FLOATS);
		let used = 0;
		let gpuBytes = 0;
		let destroyed = false;
		return {
			reset(): void {
				used = 0;
			},
			drawWire(x1: number, y1: number, x2: number, y2: number, thickness: number, color: WireColor): void {
				if (used === instances.length) {
					const grown = new Float32Array(instances.length * 2);
					grown.set(instances);
					instances = grown;
				}
				instances[used++] = x1;
				instances[used++] = y1;
				instances[used++] = x2;
				instances[used++] = y2;
				instances[used++] = thickness;
				instances[used++] = color[0];
				instances[used++] = color[1];
				instances[used++] = color[2];
				instances[used++] = color[3];
			},
			flush(slack: number): void {
				if (used === 0) return;
				prepareRenderPass(gl, program, vao);
				gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
				if (gpuBytes !== instances.byteLength) {
					gpuBytes = instances.byteLength;
					gl.bufferData(gl.ARRAY_BUFFER, gpuBytes, gl.DYNAMIC_DRAW);
				}
				gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, 0, used);
				gl.uniform2f(pixelToClip, 2 / gl.drawingBufferWidth, -2 / gl.drawingBufferHeight);
				gl.uniform1f(slackUniform, slack);
				gl.drawArraysInstanced(gl.TRIANGLES, 0, SLACK_WIRE_VERTEX_COUNT, used / INSTANCE_FLOATS);
			},
			releaseMemory(): void {
				if (destroyed || gpuBytes === 0) return;
				gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);
				gpuBytes = 0;
			},
			destroy(): void {
				if (destroyed) return;
				destroyed = true;
				gl.deleteBuffer(instanceBuffer);
				gl.deleteVertexArray(vao);
				gl.deleteProgram(program);
			},
		};
	} catch (error) {
		if (buffer) gl.deleteBuffer(buffer);
		if (vertexArray) gl.deleteVertexArray(vertexArray);
		gl.deleteProgram(program);
		throw error;
	}
}
