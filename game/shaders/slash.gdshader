// Crescent slash: sword swooshes, Demon-Dweller slash waves, boss blade arcs.
// UV.x runs along the arc, UV.y across its thickness.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled, blend_mix;
#include "res://shaders/noise.gdshaderinc"

uniform vec4 core_color : source_color = vec4(0.02, 0.02, 0.03, 1.0);
uniform vec4 edge_color : source_color = vec4(0.95, 0.95, 1.0, 1.0);
uniform float intensity = 3.0;
uniform float life = 0.0; // 0..1 fades the slash out

void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float r = length(c);
	float ang = atan(c.y, c.x);
	float arc = smoothstep(0.0, 0.25, c.y + 0.2) * smoothstep(1.0, 0.55, r) * smoothstep(0.45, 0.82, r);
	float taper = smoothstep(1.0, 0.0, abs(c.x)) ;
	float n = fbm(vec2(ang * 3.0, r * 6.0) + TIME * 3.0);
	float shape = arc * taper * (0.6 + n * 0.8);
	float edge = smoothstep(0.7, 0.86, r) * arc;
	if (shape < 0.05 + life * 0.6) { discard; }
	ALBEDO = mix(core_color.rgb, edge_color.rgb, edge);
	EMISSION = edge_color.rgb * edge * intensity * (1.0 - life);
	ALPHA = clamp(shape * 1.6, 0.0, 1.0) * (1.0 - life);
}
