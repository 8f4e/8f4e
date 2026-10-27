export const vertexShaderSource = `#version 300 es
	precision highp float;
	precision highp int;

	uniform vec2 u_patternScale;
	uniform uint u_firstLayer;
	out highp vec2 v_patternPosition;
	flat out uint v_layer;

	const vec2 POSITIONS[3] = vec2[](
		vec2(-1.0, -1.0),
		vec2(3.0, -1.0),
		vec2(-1.0, 3.0)
	);

	void main() {
		vec2 position = POSITIONS[gl_VertexID];
		gl_Position = vec4(position, 0.0, 1.0);
		v_patternPosition = (position * vec2(1.0, -1.0) + 1.0) * 0.5 * u_patternScale;
		v_layer = uint(gl_InstanceID) + u_firstLayer;
	}
`;

export const fragmentShaderSource = `#version 300 es
	precision mediump float;
	precision highp int;

	uniform highp vec4 u_dotBounds;
	uniform vec4 u_baseColor;
	uniform vec4 u_evenColor;
	uniform vec4 u_oddColor;
	in highp vec2 v_patternPosition;
	flat in uint v_layer;
	out vec4 outColor;

	void main() {
		if (v_layer == 0u) {
			outColor = u_baseColor;
		} else {
			highp vec2 repeated = fract(v_patternPosition);
			highp vec2 local = vec2(fract(repeated.x * 2.0), repeated.y);
			if (any(lessThan(local, u_dotBounds.xy)) || any(greaterThanEqual(local, u_dotBounds.zw))) discard;
			outColor = repeated.x < 0.5 ? u_evenColor : u_oddColor;
		}
		if (outColor.a == 0.0) discard;
	}
`;
