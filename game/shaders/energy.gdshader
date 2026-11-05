// Magic energy: projectiles, beams, shockwave rings, barriers, auras. Additive, fresnel-rimmed,
// with scrolling noise so every element reads as living magic.
shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
#include "res://shaders/noise.gdshaderinc"

uniform vec4 core_color : source_color = vec4(1.0);
uniform vec4 rim_color : source_color = vec4(0.4, 1.0, 0.7, 1.0);
uniform float intensity = 2.0;
uniform float scroll_speed = 1.5;
uniform float noise_scale = 3.0;
uniform float alpha = 1.0;
uniform float fresnel_power = 2.0;
uniform float dark = 0.0; // >0 for anti-magic / dark elements: render a black core with a bright rim

void fragment() {
	vec2 uv = UV * noise_scale + vec2(0.0, -TIME * scroll_speed);
	float n = fbm(uv) * 0.7 + fbm(uv * 2.7 + 7.0) * 0.5;
	float fres = pow(1.0 - clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0), fresnel_power);
	vec3 c = mix(core_color.rgb, rim_color.rgb, fres) * (0.55 + n * 0.9);
	c *= mix(1.0, fres * 1.6, dark);
	ALBEDO = vec3(0.0);
	EMISSION = c * intensity * alpha;
}
