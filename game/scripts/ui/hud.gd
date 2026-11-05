extends CanvasLayer
## In-fight HUD: Asta's vitals, anti-magic gauge, form + abilities, boss bar, lock-on,
## move-name callouts, damage vignette and the victory/defeat banner.


class Bar extends Control:
	var value := 1.0
	var trail := 1.0
	var fill := Color(0.7, 0.1, 0.1)
	var trail_col := Color(1.0, 0.85, 0.5)
	var marks: Array = []
	var _hold := 0.0
	var _primed := false

	func set_value(v: float) -> void:
		if not _primed:
			_primed = true
			value = clampf(v, 0.0, 1.0)
			trail = value
			return
		if v < value:
			_hold = 0.6
		value = clampf(v, 0.0, 1.0)
		if value > trail:
			trail = value

	func _process(delta: float) -> void:
		_hold -= delta
		if _hold <= 0.0 and trail > value:
			trail = move_toward(trail, value, delta * 0.6)
		queue_redraw()

	func _draw() -> void:
		var r := Rect2(Vector2.ZERO, size)
		draw_rect(r, Color(0, 0, 0, 0.7))
		draw_rect(Rect2(Vector2(1, 1), Vector2((size.x - 2) * trail, size.y - 2)), trail_col)
		draw_rect(Rect2(Vector2(1, 1), Vector2((size.x - 2) * value, size.y - 2)), fill)
		draw_rect(Rect2(Vector2(1, 1), Vector2((size.x - 2) * value, (size.y - 2) * 0.35)), Color(1, 1, 1, 0.12))
		for m in marks:
			var x: float = size.x * float(m)
			draw_line(Vector2(x, 0), Vector2(x, size.y), Color(1, 1, 1, 0.45), 1.0)
		draw_rect(r, Color(UIKit.GOLD, 0.55), false, 1.0)


class Reticle extends Control:
	var target := Vector2.ZERO
	var active := false
	var crit := false

	func _process(_d: float) -> void:
		queue_redraw()

	func _draw() -> void:
		var c := size * 0.5
		draw_circle(c, 2.0, Color(1, 1, 1, 0.75))
		if active:
			var t := Time.get_ticks_msec() * 0.004
			var s := 16.0 + sin(t) * 2.0
			var col := Color(1, 0.85, 0.4) if crit else Color(1, 1, 1, 0.9)
			var pts := PackedVector2Array([target + Vector2(0, -s), target + Vector2(s, 0), target + Vector2(0, s), target + Vector2(-s, 0), target + Vector2(0, -s)])
			draw_polyline(pts, col, 2.0, true)
			draw_circle(target, 3.0, col)


var arena: Node
var player: Player
var boss: Boss

var _root: Control
var _hp: Bar
var _stam: Bar
var _gauge: Bar
var _boss_bar: Bar
var _poise_bar: Bar
var _boss_name: Label
var _phase_label: Label
var _callout: Label
var _message: Label
var _mode_label: Label
var _heal_label: Label
var _ab_q: Label
var _ab_e: Label
var _fps: Label
var _timer: Label
var _reticle: Reticle
var _vignette: ColorRect
var _vig_mat: ShaderMaterial
var _card: VBoxContainer
var _banner: Label
var _banner_sub: Label
var _hurt := 0.0


func bind(p_arena: Node) -> void:
	arena = p_arena
	player = arena.get("player")
	boss = arena.get("boss")
	_build()
	boss.hp_changed.connect(func(hp, mx): _boss_bar.set_value(hp / mx))
	boss.phase_changed.connect(_on_phase)
	boss.announce.connect(_on_announce)
	boss.died.connect(func(): _show_banner("LIMIT SURPASSED", "%s defeated" % boss.def["name"], Color(1.0, 0.85, 0.45)))
	player.message.connect(_on_message)
	player.took_damage.connect(func(d): _hurt = clampf(_hurt + d / 150.0, 0.0, 1.0))
	player.died.connect(func(): _show_banner("DEFEATED", "Never give up. Surpass your limits.", Color(0.85, 0.12, 0.12)))
	_intro_card()


func _build() -> void:
	layer = 5
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	_vignette = ColorRect.new()
	_vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vig_mat = ShaderMaterial.new()
	_vig_mat.shader = load("res://shaders/vignette.gdshader")
	_vignette.material = _vig_mat
	_root.add_child(_vignette)

	_reticle = Reticle.new()
	_reticle.set_anchors_preset(Control.PRESET_FULL_RECT)
	_reticle.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_reticle)

	# Vitals (top-left).
	var vit := VBoxContainer.new()
	vit.position = Vector2(40, 34)
	vit.add_theme_constant_override("separation", 6)
	_root.add_child(vit)
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 14)
	name_row.add_child(UIKit.label("ASTA", 24, UIKit.TEXT))
	_mode_label = UIKit.label("BASE", 20, UIKit.GOLD)
	name_row.add_child(_mode_label)
	vit.add_child(name_row)
	_hp = _bar(vit, Vector2(clampf(player.max_hp * 0.42, 300, 560), 18), Color(0.72, 0.08, 0.1))
	_stam = _bar(vit, Vector2(clampf(player.max_stamina * 3.0, 240, 420), 11), Color(0.35, 0.68, 0.32))
	var grow := HBoxContainer.new()
	grow.add_theme_constant_override("separation", 10)
	vit.add_child(grow)
	_gauge = _bar(grow, Vector2(360, 13), Color(0.08, 0.08, 0.09))
	_gauge.trail_col = Color(0.95, 0.95, 1.0)
	_gauge.marks = [0.25, 1.0]
	grow.add_child(UIKit.label("ANTI-MAGIC", 13, UIKit.DIM, 3))
	var abil := HBoxContainer.new()
	abil.add_theme_constant_override("separation", 22)
	vit.add_child(abil)
	_ab_q = UIKit.label("", 16)
	_ab_e = UIKit.label("", 16)
	_heal_label = UIKit.label("", 16, Color(0.6, 1.0, 0.6))
	abil.add_child(_ab_q)
	abil.add_child(_ab_e)
	abil.add_child(_heal_label)
	vit.add_child(UIKit.label("[1] Base  [2] Black Form ≥25%  [3] Devil Union 100%", 13, UIKit.DIM, 3))

	# Boss bar (bottom-centre).
	var bb := VBoxContainer.new()
	bb.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	bb.position = Vector2(-480, -150)
	bb.custom_minimum_size = Vector2(960, 0)
	bb.add_theme_constant_override("separation", 4)
	_root.add_child(bb)
	var brow := HBoxContainer.new()
	_boss_name = UIKit.label(boss.def["name"], 28)
	brow.add_child(_boss_name)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	brow.add_child(sp)
	_phase_label = UIKit.label(boss.phase().get("name", ""), 17, UIKit.GOLD)
	brow.add_child(_phase_label)
	bb.add_child(brow)
	_boss_bar = _bar(bb, Vector2(960, 16), Color(0.62, 0.06, 0.08))
	var marks: Array = []
	for i in range(1, boss.def["phases"].size()):
		marks.append(float(boss.def["phases"][i]["threshold"]))
	_boss_bar.marks = marks
	_poise_bar = _bar(bb, Vector2(960, 4), Color(0.95, 0.82, 0.45))
	_callout = UIKit.label("", 20, Color(1, 1, 1, 0.0))
	_callout.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bb.add_child(_callout)

	_message = UIKit.label("", 30, Color(1, 1, 1, 0))
	_message.set_anchors_preset(Control.PRESET_CENTER)
	_message.position = Vector2(-400, 90)
	_message.custom_minimum_size = Vector2(800, 0)
	_message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_message)

	var tr := VBoxContainer.new()
	tr.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	tr.position = Vector2(-220, 30)
	tr.custom_minimum_size = Vector2(190, 0)
	_fps = UIKit.label("", 16, UIKit.DIM, 3)
	_fps.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_timer = UIKit.label("", 20, UIKit.TEXT, 3)
	_timer.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	tr.add_child(_fps)
	tr.add_child(_timer)
	_root.add_child(tr)

	_banner = UIKit.label("", 110, Color(1, 1, 1, 0), 10)
	_banner.set_anchors_preset(Control.PRESET_CENTER)
	_banner.position = Vector2(-800, -120)
	_banner.custom_minimum_size = Vector2(1600, 0)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_banner)
	_banner_sub = UIKit.label("", 26, Color(1, 1, 1, 0))
	_banner_sub.set_anchors_preset(Control.PRESET_CENTER)
	_banner_sub.position = Vector2(-800, 40)
	_banner_sub.custom_minimum_size = Vector2(1600, 0)
	_banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_banner_sub)


func _bar(parent: Control, sz: Vector2, col: Color) -> Bar:
	var b := Bar.new()
	b.custom_minimum_size = sz
	b.fill = col
	parent.add_child(b)
	return b


func _intro_card() -> void:
	_card = VBoxContainer.new()
	_card.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_card.position = Vector2(80, -330)
	var n := UIKit.label(boss.def["name"].to_upper(), 72, UIKit.TEXT, 8)
	var t := UIKit.label(boss.def["title"], 24, UIKit.GOLD)
	var m := UIKit.label(boss.def.get("magic", ""), 18, UIKit.DIM)
	var place := UIKit.label(arena.info.get("label", ""), 16, UIKit.DIM)
	for c in [n, t, m, place]:
		_card.add_child(c)
	_root.add_child(_card)
	_card.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(_card, "modulate:a", 1.0, 0.6)
	tw.tween_interval(2.2)
	tw.tween_property(_card, "modulate:a", 0.0, 0.8)
	tw.tween_callback(_card.queue_free)


func _on_phase(_idx: int, pname: String) -> void:
	_phase_label.text = pname
	_flash_label(_message, pname.to_upper(), Color(1.0, 0.85, 0.5), 2.2)


func _on_announce(text: String) -> void:
	if text == "":
		return
	_flash_label(_callout, text, Color(0.95, 0.93, 0.88), 1.6)


func _on_message(text: String, col: Color) -> void:
	_flash_label(_message, text, col, 1.1)


func _flash_label(l: Label, text: String, col: Color, hold: float) -> void:
	l.text = text
	l.add_theme_color_override("font_color", col)
	l.modulate = Color(1, 1, 1, 1)
	var tw := l.create_tween()
	tw.tween_interval(hold)
	tw.tween_property(l, "modulate:a", 0.0, 0.5)


func _show_banner(text: String, sub: String, col: Color) -> void:
	_banner.text = text
	_banner.add_theme_color_override("font_color", col)
	_banner_sub.text = sub
	_banner_sub.add_theme_color_override("font_color", UIKit.TEXT)
	_banner.modulate.a = 0.0
	_banner_sub.modulate.a = 0.0
	_banner.scale = Vector2(1.1, 1.1)
	_banner.pivot_offset = _banner.size * 0.5
	var tw := create_tween()
	tw.tween_property(_banner, "modulate:a", 1.0, 0.8).set_delay(0.6)
	tw.parallel().tween_property(_banner, "scale", Vector2.ONE, 1.6).set_delay(0.6)
	tw.tween_property(_banner_sub, "modulate:a", 1.0, 0.5)


func _process(delta: float) -> void:
	if player == null:
		return
	_hp.set_value(player.hp / player.max_hp)
	_stam.set_value(player.stamina / player.max_stamina)
	_gauge.set_value(player.gauge / 100.0)
	var md := player.mode_data()
	_mode_label.text = md["short"]
	_mode_label.add_theme_color_override("font_color", md["color"].lightened(0.35))
	_gauge.fill = Color(0.1, 0.1, 0.11) if player.mode != "devil" else Color(0.45, 0.04, 0.05)
	_ab_q.text = _ability_text("Q", md["q"], player.cooldowns["q"])
	_ab_e.text = _ability_text("E", md["e"], player.cooldowns["e"])
	_heal_label.text = "[H] Healing Flower ×%d" % player.heals
	if boss and is_instance_valid(boss):
		_poise_bar.set_value(boss.poise / boss.max_poise)
	_fps.visible = Settings.show_fps
	_fps.text = "%d FPS" % Engine.get_frames_per_second()
	_timer.text = UIKit.fmt_time(arena.get("fight_time"))
	# Lock-on reticle.
	_reticle.active = false
	if player.lock_target and is_instance_valid(player.lock_target) and player.camera:
		var aim: Vector3 = boss.aim_point()
		if not player.camera.is_position_behind(aim):
			_reticle.active = true
			_reticle.target = player.camera.unproject_position(aim) * (_reticle.size / get_viewport().get_visible_rect().size)
			_reticle.crit = boss.state == "stagger"
	# Vignette: damage flash, low-HP pulse, form tint.
	_hurt = move_toward(_hurt, 0.0, delta * 1.6)
	var low := clampf(1.0 - player.hp / (player.max_hp * 0.3), 0.0, 1.0)
	var pulse := low * (0.35 + 0.15 * sin(Time.get_ticks_msec() * 0.008))
	_vig_mat.set_shader_parameter("amount", clampf(_hurt + pulse, 0.0, 1.0))
	_vig_mat.set_shader_parameter("mode_amount", 0.0 if player.mode == "base" else (0.35 if player.mode == "black" else 0.55))
	_vig_mat.set_shader_parameter("mode_tint", Color(0, 0, 0) if player.mode == "black" else Color(0.35, 0.0, 0.02))


func _ability_text(key: String, ab: Dictionary, cd: float) -> String:
	var ready := cd <= 0.0 and player.gauge >= float(ab["cost"])
	var state := "%.1fs" % cd if cd > 0.0 else ("%d%%" % int(ab["cost"]))
	return "[%s] %s %s %s" % [key, ab["name"], "●" if ready else "○", state]
