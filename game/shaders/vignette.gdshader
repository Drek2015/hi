// Full-screen vignette: red damage flash / low-HP pulse, plus a tint while transformed.
shader_type canvas_item;
uniform vec4 tint : source_color = vec4(0.6, 0.0, 0.0, 1.0);
uniform float amount = 0.0;
uniform vec4 mode_tint : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float mode_amount = 0.0;
void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float v = smoothstep(0.45, 1.45, length(c));
	vec3 col = mix(mode_tint.rgb, tint.rgb, clamp(amount * 2.0, 0.0, 1.0));
	COLOR = vec4(col, clamp(v * max(amount, mode_amount * 0.7), 0.0, 0.95));
}
