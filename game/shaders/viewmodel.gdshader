// First-person viewmodel material. Pushes depth toward the near plane (Godot 4.3+ uses
// reversed-Z) so Asta's arms and sword never clip into bosses or walls.
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_back;
#include "res://shaders/noise.gdshaderinc"

uniform vec4 albedo : source_color = vec4(1.0);
uniform float roughness : hint_range(0.0, 1.0) = 0.6;
uniform float metallic : hint_range(0.0, 1.0) = 0.0;
uniform vec4 emission_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float emission_energy = 0.0;
uniform int pattern = 0; // 0 plain, 1 Demon-Slayer blade, 2 skin, 3 grip wrap, 4 anti-magic arm, 5 cloth
uniform float blade_half_width = 0.14;
uniform float flash = 0.0;
uniform float pulse = 0.0;

varying vec3 lp;

void vertex() {
	lp = VERTEX;
	POSITION = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	POSITION.z = mix(POSITION.z, POSITION.w, 0.85);
}

void fragment() {
	vec3 col = albedo.rgb;
	float rough = roughness;
	float metal = metallic;
	vec3 emit = emission_color.rgb * emission_energy;
	if (pattern == 1) {
		// Blackened, chipped, rust-flecked great-sword.
		float chip = fbm(vec2(lp.y * 6.0, sign(lp.x) * 3.0 + lp.z)) * 0.04 + smoothstep(0.7, 0.95, fbm(vec2(lp.y * 14.0, sign(lp.x) * 5.0))) * 0.035;
		if (abs(lp.x) > blade_half_width - chip) { discard; }
		float scratches = smoothstep(0.75, 0.95, vnoise(vec2(lp.x * 90.0 + lp.y * 6.0, lp.y * 4.0)));
		float rust = smoothstep(0.55, 0.8, fbm(lp.xy * 6.0 + 3.1));
		float edge = smoothstep(blade_half_width - 0.05 - chip, blade_half_width - chip, abs(lp.x));
		col = mix(vec3(0.018, 0.018, 0.02), vec3(0.11, 0.105, 0.1), scratches * 0.6);
		col = mix(col, vec3(0.22, 0.09, 0.04), rust * 0.55);
		col = mix(col, vec3(0.42, 0.41, 0.4), edge * 0.7);
		metal = mix(0.25, 0.05, rust) + edge * 0.5;
		rough = mix(0.72, 0.95, max(rust, scratches * 0.3)) - edge * 0.35;
		SPECULAR = 0.3;
		emit += emission_color.rgb * emission_energy * (0.4 + 0.6 * fbm(lp.xy * 4.0 + TIME * vec2(0.0, 1.6))) * (0.6 + edge);
	} else if (pattern == 2) {
		float v = fbm(lp.xy * 40.0) * 0.06;
		col = albedo.rgb * (0.94 + v);
		SSS_STRENGTH = 0.35;
	} else if (pattern == 3) {
		float band = step(0.5, fract((lp.y + atan(lp.x, lp.z) * 0.02) * 26.0));
		col = mix(albedo.rgb, albedo.rgb * 0.55, band);
		rough = 0.9;
	} else if (pattern == 4) {
		float veins = smoothstep(0.62, 0.74, ridged(lp.xy * 8.0 + lp.z * 5.0));
		col = mix(vec3(0.03, 0.03, 0.035), vec3(0.09, 0.09, 0.1), fbm(lp.xy * 20.0));
		rough = 0.45;
		emit += emission_color.rgb * emission_energy * veins * (0.7 + 0.3 * sin(TIME * 5.0 + lp.y * 10.0));
	} else if (pattern == 5) {
		float weave = vnoise(lp.xy * 220.0) * 0.12;
		col = albedo.rgb * (0.9 + weave);
		rough = 0.95;
	}
	emit += vec3(1.0) * flash * 2.0;
	emit += emission_color.rgb * pulse;
	ALBEDO = col;
	ROUGHNESS = rough;
	METALLIC = metal;
	EMISSION = emit;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);
	EMISSION += emission_color.rgb * fres * emission_energy * 0.6;
}
