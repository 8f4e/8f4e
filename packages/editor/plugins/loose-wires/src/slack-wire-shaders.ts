const MAX_SAG_PIXELS = 96;
// An even segment count samples the apex and keeps chord error at or below half a pixel.
export const SLACK_WIRE_VERTEX_COUNT = 6 * 2 * Math.ceil(Math.sqrt(MAX_SAG_PIXELS / 2));

export const slackWireVertexShader = `#version 300 es
	precision highp float;

	layout(location = 0) in vec4 a_endpoints;
	layout(location = 1) in float a_thickness;
	layout(location = 2) in vec4 a_color;
	uniform vec2 u_pixelToClip;

	flat out vec4 v_color;
	flat out vec2 v_start;
	flat out vec2 v_delta;
	flat out int v_thickness;
	flat out int v_xMajor;
	flat out int v_skipEndpoint;

	const vec2 CORNERS[6] = vec2[](
		vec2(0.0, -0.5), vec2(0.0, 0.5), vec2(1.0, -0.5),
		vec2(1.0, -0.5), vec2(0.0, 0.5), vec2(1.0, 0.5)
	);

	vec2 sampleWire(float t, float sag) {
		return mix(a_endpoints.xy, a_endpoints.zw, t) + vec2(0.0, 4.0 * sag * t * (1.0 - t));
	}

	void main() {
		float sag = min(${MAX_SAG_PIXELS}.0, 0.25 * abs(a_endpoints.z - a_endpoints.x));
		int segments = sag < 0.5 ? 1 : 2 * int(ceil(sqrt(sag * 0.5)));
		int segment = gl_VertexID / 6;
		if (segment >= segments) {
			gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
			return;
		}

		vec2 start = floor(sampleWire(float(segment) / float(segments), sag) + 0.5);
		vec2 end = floor(sampleWire(float(segment + 1) / float(segments), sag) + 0.5);
		vec2 delta = end - start;
		bool xMajor = abs(delta.x) >= abs(delta.y);
		if (!xMajor) {
			start = start.yx;
			end = end.yx;
		}
		int skipEndpoint = segment > 0 ? -1 : 0;
		if (start.x > end.x) {
			vec2 previousStart = start;
			start = end;
			end = previousStart;
			skipEndpoint = -skipEndpoint;
		}
		delta = end - start;
		v_start = start;
		v_delta = delta;
		v_thickness = int(a_thickness);
		v_xMajor = xMajor ? 1 : 0;
		v_skipEndpoint = skipEndpoint;
		v_color = a_color;

		// Cover each segment with a narrow quad, not the full bounding box of the wire.
		vec2 corner = CORNERS[gl_VertexID % 6];
		vec2 direction = vec2(1.0, delta.y / max(delta.x, 1.0));
		vec2 pixelPosition = mix(start, end, corner.x) + 0.5 + direction * (corner.x - 0.5);
		pixelPosition.y += corner.y * float(v_thickness + 2);
		if (!xMajor) pixelPosition = pixelPosition.yx;
		gl_Position = vec4(pixelPosition * u_pixelToClip + vec2(-1.0, 1.0), 0.0, 1.0);
	}
`;

export const slackWireFragmentShader = `#version 300 es
	precision highp float;
	precision highp int;

	uniform vec2 u_pixelToClip;
	flat in vec4 v_color;
	flat in vec2 v_start;
	flat in vec2 v_delta;
	flat in int v_thickness;
	flat in int v_xMajor;
	flat in int v_skipEndpoint;
	out vec4 outColor;

	void main() {
		vec2 pixel = floor(vec2(gl_FragCoord.x, -2.0 / u_pixelToClip.y - gl_FragCoord.y));
		if (v_xMajor == 0) pixel = pixel.yx;
		float step = pixel.x - v_start.x;
		if (step < 0.0 || step > v_delta.x ||
			(v_skipEndpoint < 0 && step == 0.0) ||
			(v_skipEndpoint > 0 && step == v_delta.x)) discard;

		// Evaluate the staircase at whole pixels, including the final connector.
		float minorStep = floor(step * abs(v_delta.y) / max(v_delta.x, 1.0) + 0.5);
		float center = v_start.y + sign(v_delta.y) * minorStep;
		float offset = pixel.y - center + float(v_thickness / 2);
		if (offset < 0.0 || offset >= float(v_thickness)) discard;
		outColor = vec4(v_color.rgb * v_color.a, v_color.a);
	}
`;
