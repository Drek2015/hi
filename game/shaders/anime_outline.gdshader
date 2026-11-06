// Inverted-hull outline whose width stays roughly constant on screen (thin up close, readable far
// away) and whose colour is a dark shade of the part's own colour instead of flat black.
shader_type spatial;
render_mode unshaded, cull_front, depth_draw_opaque, shadows_disabled;

uniform vec4 line_color : source_color = vec4(0.05, 0.03, 0.05, 1.0);
uniform float width = 0.0025;

void vertex() {
	float depth = -(MODELVIEW_MATRIX * vec4(VERTEX, 1.0)).z;
	VERTEX += NORMAL * width * clamp(depth * 0.35, 0.8, 6.0);
}

void fragment() {
	ALBEDO = line_color.rgb;
}
