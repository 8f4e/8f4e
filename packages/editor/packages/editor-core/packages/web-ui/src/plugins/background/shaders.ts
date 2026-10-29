export const vertexShaderSource = `#version 300 es
	precision highp float;

	uniform vec2 u_patternScale;
	out highp vec2 v_patternPosition;

	const vec2 POSITIONS[3] = vec2[](
		vec2(-1.0, -1.0),
		vec2(3.0, -1.0),
		vec2(-1.0, 3.0)
	);

	void main() {
		vec2 position = POSITIONS[gl_VertexID];
		gl_Position = vec4(position, 0.0, 1.0);
		v_patternPosition = (position * vec2(1.0, -1.0) + 1.0) * 0.5 * u_patternScale;
	}
`;

export const fragmentShaderSource = `#version 300 es
	precision mediump float;

	uniform highp vec4 u_dotBounds;
	uniform vec4 u_baseColor;
	uniform vec4 u_evenColor;
	uniform vec4 u_oddColor;
	in highp vec2 v_patternPosition;
	out vec4 outColor;

	void main() {
		highp vec2 repeated = fract(v_patternPosition);
		highp vec2 local = vec2(fract(repeated.x * 2.0), repeated.y);
		outColor = u_baseColor;
		if (all(greaterThanEqual(local, u_dotBounds.xy)) && all(lessThan(local, u_dotBounds.zw))) {
			outColor = repeated.x < 0.5 ? u_evenColor : u_oddColor;
		}
		if (outColor.a == 0.0) discard;
	}
`;
