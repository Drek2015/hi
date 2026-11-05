// Wind-swayed foliage for grass blades and tree canopies.
shader_type spatial;
render_mode cull_disabled, diffuse_burley;
#include "res://shaders/noise.gdshaderinc"

uniform vec4 base_color : source_color = vec4(0.12, 0.25, 0.06, 1.0);
uniform vec4 tip_color : source_color = vec4(0.5, 0.65, 0.2, 1.0);
uniform float sway = 0.15;
uniform float height = 1.0;

void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float k = clamp(VERTEX.y / height, 0.0, 1.0);
	float w = sin(TIME * 1.7 + wp.x * 0.35 + wp.z * 0.2) + 0.5 * sin(TIME * 3.1 + wp.z * 0.7);
	VERTEX.x += w * sway * k * k;
	VERTEX.z += w * sway * 0.5 * k * k;
}

void fragment() {
	float k = clamp(UV.y, 0.0, 1.0);
	ALBEDO = mix(tip_color.rgb, base_color.rgb, k);
	ROUGHNESS = 0.85;
	BACKLIGHT = vec3(0.35, 0.45, 0.15);
}
