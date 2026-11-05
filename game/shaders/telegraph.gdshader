// Ground telegraph for incoming area attacks. progress 0..1 fills the circle as the hit approaches.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled, blend_add;

uniform vec4 color : source_color = vec4(1.0, 0.3, 0.2, 1.0);
uniform float progress = 0.0;
uniform float intensity = 1.6;

void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float r = length(c);
	if (r > 1.0) { discard; }
	float ring = smoothstep(0.9, 0.97, r) * smoothstep(1.0, 0.97, r);
	float fill = step(r, progress) * 0.22;
	float front = smoothstep(progress - 0.06, progress, r) * step(r, progress) * 0.8;
	float runes = step(0.6, fract(atan(c.y, c.x) * 3.8197 + TIME * 0.5)) * smoothstep(0.78, 0.8, r) * smoothstep(0.86, 0.84, r);
	float a = ring + fill + front + runes * 0.5;
	EMISSION = color.rgb * a * intensity * (0.8 + 0.2 * sin(TIME * 18.0));
	ALBEDO = vec3(0.0);
}
