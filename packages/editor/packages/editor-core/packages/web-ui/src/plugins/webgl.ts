import type { RenderHook } from 'glugglugglug';

/**
 * Compiles and links a WebGL2 program while preserving detailed shader errors.
 *
 * @param gl - WebGL2 context that owns the program.
 * @param vertexSource - GLSL vertex shader source.
 * @param fragmentSource - GLSL fragment shader source.
 * @param label - Human-readable name used in allocation and linker errors.
 * @returns Linked WebGL program using the attribute locations declared by the shaders.
 */
export function createProgram(
	gl: WebGL2RenderingContext,
	vertexSource: string,
	fragmentSource: string,
	label: string
): WebGLProgram {
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource, label);
	let fragmentShader: WebGLShader | null = null;
	let program: WebGLProgram | null = null;
	try {
		fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, label);
		program = requireResource(gl.createProgram(), `${label} shader program`);
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) ?? `Could not link the ${label} shader program.`);
		}
		return program;
	} catch (error) {
		if (program) {
			gl.deleteProgram(program);
		}
		throw error;
	} finally {
		gl.deleteShader(vertexShader);
		if (fragmentShader) {
			gl.deleteShader(fragmentShader);
		}
	}
}

/**
 * Establishes the default-framebuffer state and premultiplied-alpha blending required by each plugin pass.
 *
 * @param gl - Shared WebGL2 context to configure.
 * @param program - Plugin shader program to bind.
 * @param vertexArray - Plugin rectangle vertex array to bind.
 */
export function prepareRenderPass(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	vertexArray: WebGLVertexArrayObject
): void {
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	gl.useProgram(program);
	gl.bindVertexArray(vertexArray);
	gl.colorMask(true, true, true, true);
	gl.disable(gl.SCISSOR_TEST);
	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.STENCIL_TEST);
	gl.disable(gl.CULL_FACE);
	gl.disable(gl.RASTERIZER_DISCARD);
	gl.enable(gl.BLEND);
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

/**
 * Removes one exact callback from a mutable render-hook list.
 *
 * @param hooks - Hook list to mutate.
 * @param hook - Callback identity to remove when present.
 */
export function removeHook(hooks: RenderHook[], hook: RenderHook): void {
	const index = hooks.indexOf(hook);
	if (index !== -1) {
		hooks.splice(index, 1);
	}
}

/**
 * Narrows a nullable WebGL allocation result or throws a descriptive error.
 *
 * @param resource - Resource returned by a WebGL creation call.
 * @param name - Human-readable resource name.
 * @returns Allocated resource.
 */
export function requireResource<T>(resource: T | null, name: string): T {
	if (!resource) {
		throw new Error(`Could not create the WebGL ${name}.`);
	}
	return resource;
}

/**
 * Compiles one shader and includes the driver log in compilation failures.
 *
 * @param gl - WebGL2 context that owns the shader.
 * @param type - WebGL shader type.
 * @param source - GLSL source to compile.
 * @param label - Human-readable plugin name used in errors.
 * @returns Compiled WebGL shader.
 */
function createShader(gl: WebGL2RenderingContext, type: number, source: string, label: string): WebGLShader {
	const shader = requireResource(gl.createShader(type), `${label} shader`);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) ?? `Could not compile a ${label} shader.`;
		gl.deleteShader(shader);
		throw new Error(message);
	}
	return shader;
}

/** Resolves a required plugin uniform. */
export function requireUniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
	const location = gl.getUniformLocation(program, name);
	if (location === null) throw new Error(`Could not find the ${name} render-plugin uniform.`);
	return location;
}
