// Sword trail ribbon for the viewmodel (same near-plane depth push as viewmodel.gdshader).
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled, blend_mix;
#include "res://shaders/noise.gdshaderinc"
uniform vec4 core_color : source_color = vec4(0.02, 0.02, 0.03, 1.0);
uniform vec4 edge_color : source_color = vec4(0.9, 0.92, 1.0, 1.0);
uniform float intensity = 2.5;
void vertex() {
	POSITION = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	POSITION.z = mix(POSITION.z, POSITION.w, 0.84);
}
void fragment() {
	float along = UV.x;      // 0 = newest, 1 = oldest
	float across = UV.y;     // 0 = blade base, 1 = tip
	float n = fbm(vec2(along * 6.0 - TIME * 4.0, across * 3.0));
	float edge = smoothstep(0.55, 1.0, across);
	float a = (1.0 - along) * smoothstep(0.0, 0.25, across) * (0.55 + n * 0.6) * COLOR.a;
	ALBEDO = mix(core_color.rgb, edge_color.rgb, edge * (1.0 - along));
	EMISSION = edge_color.rgb * edge * intensity * (1.0 - along);
	ALPHA = clamp(a, 0.0, 1.0);
}
