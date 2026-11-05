extends Control
## Display / performance / control settings. Changes apply immediately.

signal back


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	process_mode = Node.PROCESS_MODE_ALWAYS
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.75)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := UIKit.panel(Vector2(900, 0))
	center.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	panel.add_child(col)
	col.add_child(UIKit.label("SETTINGS", 40, UIKit.GOLD, 6))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 30)
	grid.add_theme_constant_override("v_separation", 10)
	col.add_child(grid)

	var fps_labels: Array = []
	for f in Settings.FPS_OPTIONS:
		fps_labels.append("Unlimited" if f == 0 else "%d" % f)
	_option(grid, "Frame-rate cap", fps_labels, Settings.FPS_OPTIONS.find(Settings.max_fps), func(i): Settings.max_fps = Settings.FPS_OPTIONS[i])
	_check(grid, "VSync (adds latency)", Settings.vsync, func(v): Settings.vsync = v)
	_check(grid, "Exclusive fullscreen", Settings.fullscreen, func(v): Settings.fullscreen = v)
	_option(grid, "Graphics quality", ["Low", "Medium", "High", "Ultra (SDFGI)"], Settings.QUALITY_OPTIONS.find(Settings.quality), func(i): Settings.quality = Settings.QUALITY_OPTIONS[i])
	_slider(grid, "Render scale (FSR 2)", 0.5, 1.0, 0.05, Settings.render_scale, func(v): Settings.render_scale = v, "%d%%", 100.0)
	_slider(grid, "Field of view", 70, 115, 1, Settings.fov, func(v): Settings.fov = v, "%d°", 1.0)
	_slider(grid, "Mouse sensitivity", 0.02, 0.3, 0.005, Settings.mouse_sensitivity, func(v): Settings.mouse_sensitivity = v, "%.3f", 1.0)
	_check(grid, "Invert look Y", Settings.invert_y, func(v): Settings.invert_y = v)
	_check(grid, "Show FPS counter", Settings.show_fps, func(v): Settings.show_fps = v)
	_slider(grid, "Master volume", 0.0, 1.0, 0.05, Settings.master_volume, func(v): Settings.master_volume = v, "%d%%", 100.0)
	grid.add_child(UIKit.label("Backend URL", 20))
	var url := LineEdit.new()
	url.text = Settings.backend_url
	url.custom_minimum_size = Vector2(380, 40)
	url.text_submitted.connect(func(t): Settings.backend_url = t; _commit(); Backend.check_health())
	url.focus_exited.connect(func(): Settings.backend_url = url.text; _commit())
	grid.add_child(url)
	col.add_child(UIKit.label("Tip: for 240 Hz use exclusive fullscreen, VSync off, cap 240, quality High.", 15, UIKit.DIM, 2))
	var b := UIKit.button("Back", func(): _commit(); back.emit(), 24, 860)
	col.add_child(b)
	b.grab_focus()


func _commit() -> void:
	Settings.apply()
	Settings.save_settings()


func _option(grid: GridContainer, text: String, items: Array, sel: int, cb: Callable) -> void:
	grid.add_child(UIKit.label(text, 20))
	var o := OptionButton.new()
	for it in items:
		o.add_item(it)
	o.select(maxi(sel, 0))
	o.custom_minimum_size = Vector2(380, 40)
	o.add_theme_font_size_override("font_size", 18)
	o.item_selected.connect(func(i): cb.call(i); _commit())
	grid.add_child(o)


func _check(grid: GridContainer, text: String, val: bool, cb: Callable) -> void:
	grid.add_child(UIKit.label(text, 20))
	var c := CheckButton.new()
	c.button_pressed = val
	c.toggled.connect(func(v): cb.call(v); _commit())
	grid.add_child(c)


func _slider(grid: GridContainer, text: String, lo: float, hi: float, step: float, val: float, cb: Callable, fmt: String, mul: float) -> void:
	grid.add_child(UIKit.label(text, 20))
	var row := HBoxContainer.new()
	var s := HSlider.new()
	s.min_value = lo
	s.max_value = hi
	s.step = step
	s.value = val
	s.custom_minimum_size = Vector2(300, 32)
	var l := UIKit.label(fmt % (val * mul), 18, UIKit.DIM, 2)
	s.value_changed.connect(func(v): cb.call(v); l.text = fmt % (v * mul))
	s.drag_ended.connect(func(_c): _commit())
	row.add_child(s)
	row.add_child(l)
	grid.add_child(row)
