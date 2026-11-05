class_name UIKit
## Shared UI styling: dark parchment panels, gold trim, crisp outlined type.

const GOLD := Color(0.86, 0.72, 0.42)
const INK := Color(0.04, 0.04, 0.05, 0.92)
const TEXT := Color(0.93, 0.91, 0.86)
const DIM := Color(0.62, 0.6, 0.56)
const RED := Color(0.78, 0.1, 0.12)


static func box(bg: Color, border: Color = GOLD, width: int = 1, radius: int = 2, pad: int = 12) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(width)
	s.set_corner_radius_all(radius)
	s.content_margin_left = pad
	s.content_margin_right = pad
	s.content_margin_top = pad * 0.6
	s.content_margin_bottom = pad * 0.6
	s.shadow_color = Color(0, 0, 0, 0.45)
	s.shadow_size = 6
	return s


static func label(text: String, size: int = 22, color: Color = TEXT, outline: int = 4) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_constant_override("outline_size", outline)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	return l


static func button(text: String, cb: Callable, size: int = 24, min_w: int = 320) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_w, size * 2.1)
	b.add_theme_font_size_override("font_size", size)
	b.add_theme_color_override("font_color", TEXT)
	b.add_theme_color_override("font_hover_color", Color(1, 0.95, 0.8))
	b.add_theme_color_override("font_focus_color", Color(1, 0.95, 0.8))
	b.add_theme_stylebox_override("normal", box(Color(0.05, 0.05, 0.06, 0.85), Color(GOLD, 0.35)))
	b.add_theme_stylebox_override("hover", box(Color(0.14, 0.11, 0.08, 0.95), GOLD, 2))
	b.add_theme_stylebox_override("focus", box(Color(0.14, 0.11, 0.08, 0.95), GOLD, 2))
	b.add_theme_stylebox_override("pressed", box(Color(0.3, 0.05, 0.06, 0.95), GOLD, 2))
	b.add_theme_stylebox_override("disabled", box(Color(0.05, 0.05, 0.06, 0.5), Color(GOLD, 0.15)))
	b.pressed.connect(func(): Sfx.play("ui_select", null, -8.0))
	b.mouse_entered.connect(func(): Sfx.play("ui_move", null, -16.0))
	b.focus_entered.connect(func(): Sfx.play("ui_move", null, -16.0))
	if cb.is_valid():
		b.pressed.connect(cb)
	return b


static func panel(min_size: Vector2 = Vector2.ZERO) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", box(INK, Color(GOLD, 0.6), 1, 3, 22))
	p.custom_minimum_size = min_size
	return p


static func backdrop(parent: Control) -> ColorRect:
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/menu_bg.gdshader")
	bg.material = m
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(bg)
	return bg


static func fmt_time(t: float) -> String:
	if t <= 0.0:
		return "--:--"
	return "%d:%05.2f" % [int(t) / 60, fmod(t, 60.0)]
