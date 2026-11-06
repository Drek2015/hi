class_name Cutscene
extends Node
## Data-driven in-engine cutscene (data/cutscenes/<id>.json): letterboxed cinematic camera shots
## with depth of field, boss poses, VFX, screen shake, dialogue and a closing title card.
## Shots in "boss" space are authored relative to the boss (its -Z faces Asta); "pov" shots use
## Asta's own first-person camera so the player's sword can react. Any combat input skips.

signal finished

const SKIP_ACTIONS := ["pause", "attack_light", "jump", "dodge"]
const CHARS_PER_SEC := 42.0

var arena: Node
var data: Dictionary = {}
var _cam: Camera3D
var _attrs: CameraAttributesPractical
var _ui: CanvasLayer
var _bars: Array[ColorRect] = []
var _speaker: Label
var _line: Label
var _title: VBoxContainer
var _skip_hint: Label
var _shot := -1
var _t := 0.0
var _fired: Dictionary = {}
var _line_full := ""
var _line_t := 0.0
var _done := false


static func path_for(id: String) -> String:
	return "res://data/cutscenes/%s.json" % id


func setup(p_arena: Node, id: String) -> bool:
	arena = p_arena
	var f := FileAccess.open(path_for(id), FileAccess.READ)
	if f == null:
		return false
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	if not (parsed is Dictionary) or (parsed as Dictionary).get("shots", []).is_empty():
		return false
	data = parsed
	return true


func _ready() -> void:
	_cam = Camera3D.new()
	_attrs = CameraAttributesPractical.new()
	_attrs.dof_blur_far_enabled = true
	_attrs.dof_blur_amount = 0.07
	_attrs.dof_blur_far_transition = 8.0
	_cam.attributes = _attrs
	arena.add_child(_cam)
	_cam.make_current()
	_build_ui()
	_next_shot()


func _build_ui() -> void:
	_ui = CanvasLayer.new()
	_ui.layer = 15
	add_child(_ui)
	for top in [true, false]:
		var bar := ColorRect.new()
		bar.color = Color(0, 0, 0)
		bar.set_anchors_preset(Control.PRESET_TOP_WIDE if top else Control.PRESET_BOTTOM_WIDE)
		bar.custom_minimum_size = Vector2(0, 0)
		bar.offset_bottom = 0.0 if top else 0.0
		_ui.add_child(bar)
		_bars.append(bar)
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	box.position = Vector2(-700, -118)
	box.custom_minimum_size = Vector2(1400, 0)
	box.add_theme_constant_override("separation", 4)
	_ui.add_child(box)
	_speaker = UIKit.label("", 22, UIKit.GOLD, 4)
	_speaker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_line = UIKit.label("", 30, UIKit.TEXT, 6)
	_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_speaker)
	box.add_child(_line)
	_skip_hint = UIKit.label("Esc / Space — skip", 14, Color(UIKit.DIM, 0.8), 3)
	_skip_hint.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_skip_hint.position = Vector2(-260, 18)
	_ui.add_child(_skip_hint)
	_title = VBoxContainer.new()
	_title.set_anchors_preset(Control.PRESET_CENTER_LEFT)
	_title.position = Vector2(110, -40)
	_title.modulate.a = 0.0
	_ui.add_child(_title)
	var tw := create_tween()
	tw.tween_method(_set_bars, 0.0, 1.0, 0.6).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _set_bars(k: float) -> void:
	var h := get_viewport().get_visible_rect().size.y * 0.11 * k
	_bars[0].offset_bottom = h
	_bars[1].offset_top = -h


func _unhandled_input(event: InputEvent) -> void:
	if _done:
		return
	for a in SKIP_ACTIONS:
		if event.is_action_pressed(a):
			get_viewport().set_input_as_handled()
			end()
			return


func _shots() -> Array:
	return data["shots"]


func _next_shot() -> void:
	_shot += 1
	_t = 0.0
	_fired.clear()
	if _shot >= _shots().size():
		end()
		return
	var s: Dictionary = _shots()[_shot]
	var player: Player = arena.get("player")
	if s.get("space", "boss") == "pov":
		player.camera.make_current()
	else:
		_cam.make_current()


func _boss() -> Boss:
	return arena.get("boss")


func _point(arr: Array, space: String) -> Vector3:
	var v := Vector3(arr[0], arr[1], arr[2])
	var boss := _boss()
	if space == "boss" and boss:
		return boss.global_transform * (v * Vector3(1, 1, 1))
	return v


func _ease(f: float, kind: String) -> float:
	match kind:
		"in": return f * f
		"out": return 1.0 - (1.0 - f) * (1.0 - f)
		"linear": return f
	return f * f * (3.0 - 2.0 * f)


func _process(delta: float) -> void:
	if _done or _shot < 0 or _shot >= _shots().size():
		return
	var s: Dictionary = _shots()[_shot]
	_t += delta
	var dur: float = s.get("duration", 3.0)
	var f := clampf(_t / dur, 0.0, 1.0)
	var space: String = s.get("space", "boss")
	if space != "pov":
		var e := _ease(f, s.get("ease", "inout"))
		var a: Dictionary = s["from"]
		var b: Dictionary = s.get("to", a)
		var pos := _point(a["pos"], space).lerp(_point(b["pos"], space), e)
		var look := _point(a["look"], space).lerp(_point(b["look"], space), e)
		_cam.global_position = pos
		if pos.distance_to(look) > 0.01:
			_cam.look_at(look, Vector3.UP)
		var fov: Array = s.get("fov", [40, 40])
		_cam.fov = lerpf(fov[0], fov[1], e)
		_attrs.dof_blur_far_distance = float(s.get("focus", pos.distance_to(look))) + float(s.get("focus_depth", 2.5))
	for i in s.get("events", []).size():
		var ev: Dictionary = s["events"][i]
		if not _fired.has(i) and _t >= float(ev.get("at", 0.0)):
			_fired[i] = true
			_fire(ev)
	if _line_full != "":
		_line_t += delta
		_line.text = _line_full.substr(0, int(_line_t * CHARS_PER_SEC))
	if _t >= dur:
		_next_shot()


func _fire(ev: Dictionary) -> void:
	var boss := _boss()
	var player: Player = arena.get("player")
	if ev.has("pose") and boss:
		boss.rig.set_pose(ev["pose"], float(ev.get("blend", 8.0)))
	if ev.has("line"):
		_speaker.text = str(ev["line"].get("speaker", "")).to_upper()
		_line_full = str(ev["line"].get("text", ""))
		_line_t = 0.0
		_line.text = ""
	if ev.get("clear_line", false):
		_speaker.text = ""
		_line_full = ""
		_line.text = ""
	if ev.has("vfx") and boss:
		var elem: String = ev.get("element", boss.element)
		var at := boss.aim_point()
		match ev["vfx"]:
			"burst": VFX.burst(arena, at, VFX.element(elem)["rim"], 60, 9.0, 0.22, 1.0)
			"shockwave": VFX.shockwave(arena, at, elem, float(ev.get("radius", 8.0)), 0.9)
			"flash": VFX.flash(arena, at, VFX.element(elem)["rim"], 10.0, 18.0, 0.8)
			"eyes": boss.rig.set_eye_glow(VFX.element(elem)["rim"].lightened(0.4), 8.0)
	if ev.has("shake") and player:
		player.add_shake(float(ev["shake"]))
	if ev.has("sfx"):
		Sfx.play(ev["sfx"], boss.global_position if boss else null, float(ev.get("volume", -2.0)))
	if ev.has("viewmodel") and player:
		player.viewmodel.play(ev["viewmodel"])
	if ev.get("title", false) and boss:
		_show_title(boss.def)


func _show_title(def: Dictionary) -> void:
	for c in _title.get_children():
		c.queue_free()
	_title.add_child(UIKit.label(def.get("name", "").to_upper(), 84, UIKit.TEXT, 10))
	_title.add_child(UIKit.label(def.get("title", ""), 26, UIKit.GOLD, 5))
	_title.add_child(UIKit.label(def.get("magic", ""), 18, UIKit.DIM, 3))
	var tw := create_tween()
	tw.tween_property(_title, "modulate:a", 1.0, 0.5)


func end() -> void:
	if _done:
		return
	_done = true
	var player: Player = arena.get("player")
	if player and player.camera:
		player.camera.make_current()
	var tw := create_tween()
	tw.tween_method(_set_bars, 1.0, 0.0, 0.4)
	tw.parallel().tween_property(_title, "modulate:a", 0.0, 0.4)
	tw.tween_callback(func():
		_cam.queue_free()
		finished.emit()
		queue_free())
