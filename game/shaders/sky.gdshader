// Stylised painterly sky: gradient, sun/moon disc, stars and layered clouds. No TIME use, so
// the radiance map is computed once (cheap at 240 FPS).
shader_type sky;
#include "res://shaders/noise.gdshaderinc"

uniform vec4 top_color : source_color = vec4(0.12, 0.25, 0.55, 1.0);
uniform vec4 horizon_color : source_color = vec4(0.95, 0.65, 0.4, 1.0);
uniform vec4 bottom_color : source_color = vec4(0.1, 0.08, 0.08, 1.0);
uniform vec4 cloud_color : source_color = vec4(1.0, 0.85, 0.75, 1.0);
uniform vec4 cloud_shadow : source_color = vec4(0.35, 0.3, 0.4, 1.0);
uniform float cloud_cover = 0.45;
uniform vec4 moon_color : source_color = vec4(1.0, 0.95, 0.85, 1.0);
uniform vec3 moon_dir = vec3(0.3, 0.35, -0.9);
uniform float moon_size = 0.035;
uniform float moon_crescent = 0.0;
uniform float star_amount = 0.0;
uniform float sky_energy = 1.0;

void sky() {
	vec3 d = EYEDIR;
	float h = d.y;
	vec3 col = mix(horizon_color.rgb, top_color.rgb, smoothstep(0.0, 0.55, h));
	col = mix(col, bottom_color.rgb, smoothstep(0.0, -0.25, h));
	// Sun from the scene's directional light.
	if (LIGHT0_ENABLED) {
		float s = dot(d, LIGHT0_DIRECTION);
		col += LIGHT0_COLOR * (pow(max(s, 0.0), 900.0) * 6.0 + pow(max(s, 0.0), 12.0) * 0.35) * LIGHT0_ENERGY * 0.25;
	}
	// Moon disc (optionally crescent). Skipped entirely when moon_size is 0.
	if (moon_size > 0.0) {
		vec3 md = normalize(moon_dir);
		float ang = acos(clamp(dot(d, md), -1.0, 1.0));
		float m = 1.0 - smoothstep(moon_size * 0.9, moon_size, ang);
		vec3 off = normalize(md + vec3(moon_size * 0.9, moon_size * 0.5, 0.0));
		float ang2 = acos(clamp(dot(d, off), -1.0, 1.0));
		float cut = (1.0 - smoothstep(moon_size * 0.85, moon_size * 0.95, ang2)) * moon_crescent;
		col += moon_color.rgb * max(m - cut, 0.0) * 3.0;
		col += moon_color.rgb * pow(max(dot(d, md), 0.0), 60.0) * 0.25;
	}
	// Stars.
	if (star_amount > 0.0 && h > 0.0) {
		vec2 sp = d.xz / (d.y + 0.3) * 120.0;
		float st = step(0.997, hash21(floor(sp))) * smoothstep(0.0, 0.3, h);
		col += vec3(st) * star_amount;
	}
	// Clouds on a curved plane.
	if (h > 0.0) {
		vec2 cp = d.xz / (d.y + 0.12) * 1.4;
		float c = fbm(cp + vec2(3.0, 1.0)) * 0.7 + fbm(cp * 2.6) * 0.35;
		float cov = smoothstep(1.0 - cloud_cover, 1.05 - cloud_cover * 0.5, c);
		vec3 cc = mix(cloud_shadow.rgb, cloud_color.rgb, smoothstep(0.3, 0.9, c));
		col = mix(col, cc, cov * smoothstep(0.0, 0.12, h) * 0.9);
	}
	COLOR = col * sky_energy;
}
