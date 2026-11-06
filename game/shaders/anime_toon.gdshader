// Cel-shaded material for VRoid/VRM anime characters: keeps the painted texture, can recolour a
// part (hair, outfit) by luminance, alpha-cutout for hair cards/eyelashes, rim light, hit flash.
shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled, depth_draw_opaque;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 tint : source_color = vec4(1.0);
uniform float recolor : hint_range(0.0, 1.0) = 0.0;
uniform float alpha_cut = 0.5;
uniform vec4 emission_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float emission_energy = 0.0;
uniform float flash = 0.0;
uniform float rim_amount = 0.4;
uniform float roughness = 0.75;
uniform vec4 rim_glow : source_color = vec4(0.0, 0.0, 0.0, 1.0);  // element-tinted silhouette for dark arenas

void fragment() {
	vec4 t = texture(albedo_tex, UV);
	if (t.a < alpha_cut) { discard; }
	float l = dot(t.rgb, vec3(0.299, 0.587, 0.114));
	// Recolour keeps the texture's shading detail but is anchored to the tint, so black cloth stays black.
	vec3 recol = tint.rgb * clamp(0.55 + l * 0.6, 0.0, 1.3);
	ALBEDO = mix(t.rgb * mix(vec3(1.0), tint.rgb, 1.0 - recolor), recol, recolor);
	ROUGHNESS = roughness;
	RIM = rim_amount;
	RIM_TINT = 0.6;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	EMISSION = emission_color.rgb * emission_energy * t.rgb + vec3(flash) + rim_glow.rgb * fres * 0.9;
}
