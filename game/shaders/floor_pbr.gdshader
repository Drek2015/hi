// Arena floor from scanned PBR textures (Poly Haven, CC0) with anti-tiling, plus the engraved
// emblem and optional glowing fissures layered on top.
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;
#include "res://shaders/noise.gdshaderinc"

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rough_tex : hint_roughness_gray, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D ao_tex : filter_linear_mipmap_anisotropic, repeat_enable;
uniform float uv_scale = 0.25;
uniform vec4 tint : source_color = vec4(1.0);
uniform float normal_strength = 1.0;
uniform vec4 emblem_color : source_color = vec4(0.9, 0.75, 0.35, 1.0);
uniform float emblem_energy = 0.4;
uniform vec4 fissure_color : source_color = vec4(1.0, 0.3, 0.05, 1.0);
uniform float fissure_energy = 0.0;

void fragment() {
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec2 p = wp.xz;
	vec2 uv = p * uv_scale;
	// Anti-tiling: blend two rotated/offset samples by a low-frequency mask.
	vec2 uv2 = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8)) * uv * 0.73 + vec2(0.37, 0.61);
	float m = smoothstep(0.35, 0.65, fbm(p * 0.045));
	vec3 alb = mix(texture(albedo_tex, uv).rgb, texture(albedo_tex, uv2).rgb, m);
	vec3 nrm = mix(texture(normal_tex, uv).rgb, texture(normal_tex, uv2).rgb, m) * 2.0 - 1.0;
	float rough = mix(texture(rough_tex, uv).r, texture(rough_tex, uv2).r, m);
	float ao = mix(texture(ao_tex, uv).r, texture(ao_tex, uv2).r, m);
	alb *= tint.rgb * (0.85 + 0.3 * fbm(p * 0.08));
	float r = length(p);
	float em = smoothstep(0.08, 0.0, abs(r - 4.0)) + smoothstep(0.06, 0.0, abs(r - 5.2)) + smoothstep(0.05, 0.0, abs(r - 1.5));
	float spokes = smoothstep(0.06, 0.0, abs(sin(atan(p.y, p.x) * 2.5))) * step(1.5, r) * step(r, 4.0);
	float emblem = clamp(em + spokes * 0.8, 0.0, 1.0);
	alb = mix(alb, alb * 0.35, emblem * 0.7);
	float crack = smoothstep(0.03, 0.0, abs(fbm(p * 0.35) - 0.5)) * smoothstep(0.3, 0.6, fbm(p * 0.07 + 3.0));
	vec3 n = normalize(vec3(nrm.x * normal_strength, 1.0, -nrm.y * normal_strength));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
	ALBEDO = alb;
	ROUGHNESS = rough;
	AO = ao;
	AO_LIGHT_AFFECT = 0.6;
	EMISSION = emblem_color.rgb * emblem * emblem_energy
		+ fissure_color.rgb * crack * fissure_energy * (0.7 + 0.3 * sin(TIME * 2.0 + r));
}
