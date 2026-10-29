export const lineVertexShaderSource = `#version 300 es
	precision highp float;

	layout(location = 0) in vec4 a_endpoints;
	layout(location = 1) in float a_thickness;
	layout(location = 2) in vec4 a_color;

	uniform vec2 u_pixelToClip;

	out vec4 v_color;
	flat out vec2 v_start;
	flat out vec2 v_delta;
	flat out int v_thickness;
	flat out int v_xMajor;

	const vec2 CORNERS[4] = vec2[](
		vec2(0.0, -0.5),
		vec2(0.0, 0.5),
		vec2(1.0, -0.5),
		vec2(1.0, 0.5)
	);

	void main() {
		vec2 start = floor(a_endpoints.xy + 0.5);
		vec2 end = floor(a_endpoints.zw + 0.5);
		vec2 delta = end - start;
		bool xMajor = abs(delta.x) >= abs(delta.y);
		if (!xMajor) {
			start = start.yx;
			end = end.yx;
		}
		// Give reversed endpoints the same pixel choices, including halfway ties.
		if (start.x > end.x) {
			vec2 previousStart = start;
			start = end;
			end = previousStart;
		}
		delta = end - start;
		v_start = start;
		v_delta = delta;
		v_thickness = int(a_thickness);
		v_xMajor = xMajor ? 1 : 0;

		// Keep the quad narrow while covering every staircase pixel and both endpoints.
		vec2 corner = CORNERS[gl_VertexID];
		vec2 direction = vec2(1.0, delta.y / max(delta.x, 1.0));
		vec2 pixelPosition = mix(start, end, corner.x) + 0.5 + direction * (corner.x - 0.5);
		pixelPosition.y += corner.y * float(v_thickness + 2);
		if (!xMajor) {
			pixelPosition = pixelPosition.yx;
		}
		gl_Position = vec4(pixelPosition * u_pixelToClip + vec2(-1.0, 1.0), 0.0, 1.0);
		v_color = a_color;
	}
`;

export const lineFragmentShaderSource = `#version 300 es
	precision highp float;
	precision highp int;

	uniform vec2 u_pixelToClip;

	in vec4 v_color;
	flat in vec2 v_start;
	flat in vec2 v_delta;
	flat in int v_thickness;
	flat in int v_xMajor;
	out vec4 outColor;

	void main() {
		vec2 pixel = floor(vec2(gl_FragCoord.x, -2.0 / u_pixelToClip.y - gl_FragCoord.y));
		if (v_xMajor == 0) {
			pixel = pixel.yx;
		}
		float step = pixel.x - v_start.x;
		if (step < 0.0 || step > v_delta.x) {
			discard;
		}
		// This is Bresenham's minor-axis step, evaluated directly for each fragment.
		float minorStep = floor(step * abs(v_delta.y) / max(v_delta.x, 1.0) + 0.5);
		float center = v_start.y + sign(v_delta.y) * minorStep;
		float offset = pixel.y - center + float(v_thickness / 2);
		if (offset < 0.0 || offset >= float(v_thickness)) {
			discard;
		}
		outColor = vec4(v_color.rgb * v_color.a, v_color.a);
	}
`;
