// Animated menu backdrop: drifting anti-magic smoke over a dark gradient.
shader_type canvas_item;
#include "res://shaders/noise.gdshaderinc"
uniform vec4 accent : source_color = vec4(0.75, 0.08, 0.1, 1.0);
void fragment() {
	vec2 uv = UV;
	vec2 p = uv * vec2(3.0, 1.8);
	float t = TIME * 0.06;
	float s = fbm(p + vec2(t, -t * 0.7) + fbm(p * 1.7 - t) * 1.4);
	vec3 col = mix(vec3(0.015, 0.015, 0.02), vec3(0.07, 0.065, 0.075), s);
	col += accent.rgb * pow(s, 4.0) * 0.6 * smoothstep(1.0, 0.2, uv.y);
	float v = smoothstep(1.3, 0.3, length(uv * 2.0 - 1.0));
	COLOR = vec4(col * v, 1.0);
}
