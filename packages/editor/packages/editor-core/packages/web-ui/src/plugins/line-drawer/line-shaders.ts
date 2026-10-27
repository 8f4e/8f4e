export const lineVertexShaderSource = `#version 300 es
	precision highp float;

	layout(location = 0) in vec4 a_endpoints;
	layout(location = 1) in float a_thickness;
	layout(location = 2) in vec4 a_color;

	uniform vec2 u_resolution;

	out vec4 v_color;

	const vec2 CORNERS[4] = vec2[](
		vec2(0.0, -0.5),
		vec2(0.0, 0.5),
		vec2(1.0, -0.5),
		vec2(1.0, 0.5)
	);

	void main() {
		vec2 start = a_endpoints.xy;
		vec2 end = a_endpoints.zw;
		vec2 line = end - start;
		vec2 normal = normalize(vec2(-line.y, line.x));
		vec2 corner = CORNERS[gl_VertexID];
		vec2 pixelPosition = mix(start, end, corner.x) + normal * corner.y * a_thickness;
		vec2 clipPosition = pixelPosition / u_resolution * 2.0 - 1.0;
		gl_Position = vec4(clipPosition * vec2(1.0, -1.0), 0.0, 1.0);
		v_color = a_color;
	}
`;

export const lineFragmentShaderSource = `#version 300 es
	precision mediump float;

	in vec4 v_color;
	out vec4 outColor;

	void main() {
		outColor = vec4(v_color.rgb * v_color.a, v_color.a);
	}
`;
