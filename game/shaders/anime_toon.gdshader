// Anime cel shader for VRoid/VRM characters (Genshin-style recipe, done procedurally):
//  - two-tone ramp lighting with a coloured (not grey) shadow tone and a soft terminator
//  - faces use softened lighting so they never get blotchy self-shadows
//  - hair gets a view-dependent "angel ring" highlight band
//  - painted texture kept, optional per-part recolour by luminance, alpha cutout, rim light, hit flash
shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, specular_disabled;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 tint : source_color = vec4(1.0);
uniform float recolor : hint_range(0.0, 1.0) = 0.0;
uniform float alpha_cut = 0.5;
uniform vec4 shadow_tint : source_color = vec4(0.62, 0.5, 0.62, 1.0);
uniform float ramp_center = 0.05;
uniform float ramp_soft = 0.06;
uniform float face_soften = 0.0;      // 1 = faces: lighting barely varies across the surface
uniform float hair_spec = 0.0;        // 1 = hair highlight band on
uniform vec4 emission_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float emission_energy = 0.0;
uniform vec4 rim_glow : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float flash = 0.0;

void fragment() {
	vec4 t = texture(albedo_tex, UV);
	if (t.a < alpha_cut) { discard; }
	float l = dot(t.rgb, vec3(0.299, 0.587, 0.114));
	// Recolour keeps the texture's shading detail but is anchored to the tint, so black cloth stays black.
	vec3 recol = tint.rgb * clamp(0.55 + l * 0.6, 0.0, 1.3);
	ALBEDO = mix(t.rgb * mix(vec3(1.0), tint.rgb, 1.0 - recolor), recol, recolor);
	ROUGHNESS = 1.0;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	EMISSION = emission_color.rgb * emission_energy * t.rgb + vec3(flash) + rim_glow.rgb * fres * 0.9;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	ndl = mix(ndl, 0.55, face_soften * 0.8);
	float shadow = smoothstep(0.25, 0.6, ATTENUATION);
	float lit = smoothstep(ramp_center - ramp_soft, ramp_center + ramp_soft, ndl) * mix(shadow, 1.0, face_soften * 0.6);
	vec3 tone = mix(shadow_tint.rgb, vec3(1.0), lit);
	DIFFUSE_LIGHT += tone * LIGHT_COLOR / PI;
	// Rim from the light side for a crisp anime edge.
	float rim = smoothstep(0.62, 0.72, 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0)) * smoothstep(-0.1, 0.4, ndl);
	DIFFUSE_LIGHT += rim * LIGHT_COLOR / PI * 0.35;
	if (hair_spec > 0.0) {
		float band = smoothstep(0.86, 0.9, dot(normalize(VIEW + LIGHT), NORMAL)) * (1.0 - smoothstep(0.96, 0.99, dot(normalize(VIEW + LIGHT), NORMAL)));
		SPECULAR_LIGHT += band * LIGHT_COLOR / PI * 0.35 * hair_spec * lit;
	}
}
