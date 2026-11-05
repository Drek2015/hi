// Procedural arena floor: radial flagstones with cracks, wear, moss/ash, optional glowing fissures.
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;
#include "res://shaders/noise.gdshaderinc"

uniform vec4 stone_a : source_color = vec4(0.36, 0.34, 0.31, 1.0);
uniform vec4 stone_b : source_color = vec4(0.22, 0.21, 0.2, 1.0);
uniform vec4 grout : source_color = vec4(0.08, 0.08, 0.07, 1.0);
uniform vec4 overgrowth : source_color = vec4(0.18, 0.3, 0.1, 1.0);
uniform float overgrowth_amount = 0.3;
uniform vec4 fissure_color : source_color = vec4(1.0, 0.3, 0.05, 1.0);
uniform float fissure_energy = 0.0;
uniform vec4 emblem_color : source_color = vec4(0.9, 0.75, 0.35, 1.0);
uniform float emblem_energy = 0.4;

float slab_height(vec2 p, out float id, out float g) {
	float r = length(p);
	float ring_w = 2.6;
	float ring = floor(r / ring_w);
	float count = max(6.0, floor(ring * 6.2 + 6.0));
	float a = (atan(p.y, p.x) / 6.28318 + 0.5) * count + hash21(vec2(ring, 1.0)) * 3.0;
	float seg = floor(a);
	id = hash21(vec2(ring, seg));
	float fr = fract(r / ring_w);
	float fa = fract(a);
	float gr = min(fr, 1.0 - fr) * ring_w;
	float ga = min(fa, 1.0 - fa) * (6.28318 * max(r, 0.5) / count);
	g = min(gr, ga);
	return smoothstep(0.0, 0.08, g) * (0.9 + id * 0.1);
}

void fragment() {
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec2 p = wp.xz;
	float id; float g;
	float h = slab_height(p, id, g);
	float r = length(p);
	float crack = smoothstep(0.035, 0.0, abs(fbm(p * 0.9 + id * 10.0) - 0.5)) * step(0.4, id);
	float wear = fbm(p * 1.7);
	vec3 col = mix(stone_a.rgb, stone_b.rgb, id * 0.8 + wear * 0.4);
	col *= 0.82 + 0.3 * fbm(p * 7.0);
	col = mix(grout.rgb, col, h);
	col = mix(col, grout.rgb * 0.6, crack);
	float moss = smoothstep(0.55, 0.75, fbm(p * 0.35 + 4.0) + (1.0 - h) * 0.4) * overgrowth_amount;
	col = mix(col, overgrowth.rgb * (0.7 + 0.5 * vnoise(p * 9.0)), moss);
	// Engraved centre emblem: concentric rings + five spokes.
	float em = smoothstep(0.08, 0.0, abs(r - 4.0)) + smoothstep(0.06, 0.0, abs(r - 5.2)) + smoothstep(0.05, 0.0, abs(r - 1.5));
	float spokes = smoothstep(0.06, 0.0, abs(sin(atan(p.y, p.x) * 2.5))) * step(1.5, r) * step(r, 4.0);
	float emblem = clamp(em + spokes * 0.8, 0.0, 1.0);
	col = mix(col, emblem_color.rgb * 0.5, emblem * 0.6);
	// Height-derived normal for slab bevels.
	float e = 0.02;
	float idx; float gx; float idz; float gz;
	float hx = slab_height(p + vec2(e, 0.0), idx, gx);
	float hz = slab_height(p + vec2(0.0, e), idz, gz);
	vec3 n = normalize(vec3((h - hx) * 2.5, 1.0, (h - hz) * 2.5));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
	ALBEDO = col;
	ROUGHNESS = mix(0.92, 0.6, h * (1.0 - moss)) - crack * 0.1;
	SPECULAR = 0.35;
	EMISSION = emblem_color.rgb * emblem * emblem_energy + fissure_color.rgb * (crack + (1.0 - h) * 0.6) * fissure_energy * (0.7 + 0.3 * sin(TIME * 2.0 + r));
}
