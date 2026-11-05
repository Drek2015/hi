// Opaque-ish black core used inside anti-magic / dark / shadow effects (additive can't make black).
shader_type spatial;
render_mode unshaded, cull_back, shadows_disabled, blend_mix, depth_draw_opaque;
#include "res://shaders/noise.gdshaderinc"
uniform vec4 tint : source_color = vec4(0.02, 0.02, 0.025, 1.0);
uniform vec4 rim : source_color = vec4(0.8, 0.8, 0.9, 1.0);
uniform float alpha = 0.92;
void fragment() {
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	float n = fbm(UV * 6.0 + vec2(TIME * 0.7, -TIME * 1.3));
	if (n < 0.28 * (1.0 - alpha)) { discard; }
	ALBEDO = tint.rgb;
	EMISSION = rim.rgb * fres * (1.2 + n);
	ALPHA = alpha;
}
