import { requireResource } from '@8f4e/web-ui';

/** GPU geometry owned by the RGBA texture-layer plugin. */
export type RectangleGeometry = {
	readonly buffer: WebGLBuffer;
	readonly vertexArray: WebGLVertexArrayObject;
};

/**
 * Creates reusable rectangle geometry for the RGBA texture-layer plugin.
 *
 * @param gl - WebGL2 context that owns the geometry.
 * @returns Buffer and vertex array required to draw a four-vertex triangle strip.
 */
export function createRectangleGeometry(gl: WebGL2RenderingContext): RectangleGeometry {
	const buffer = requireResource(gl.createBuffer(), 'rectangle position buffer');
	let vertexArray: WebGLVertexArrayObject | null = null;
	try {
		vertexArray = requireResource(gl.createVertexArray(), 'rectangle vertex array');
		gl.bindVertexArray(vertexArray);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		return { buffer, vertexArray };
	} catch (error) {
		if (vertexArray) {
			gl.deleteVertexArray(vertexArray);
		}
		gl.deleteBuffer(buffer);
		throw error;
	}
}

/**
 * Deletes the RGBA texture-layer plugin's reusable rectangle geometry.
 *
 * @param gl - WebGL2 context that owns the geometry.
 * @param geometry - Geometry returned by `createRectangleGeometry()`.
 */
export function deleteRectangleGeometry(gl: WebGL2RenderingContext, geometry: RectangleGeometry): void {
	gl.deleteBuffer(geometry.buffer);
	gl.deleteVertexArray(geometry.vertexArray);
}
