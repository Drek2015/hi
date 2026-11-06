extends CanvasLayer
## On-screen controls for phones/tablets: left-thumb joystick, right-side drag-to-look, and a
## thumb-arc of action buttons. Buttons inject InputEventActions, so gameplay code is unchanged.

const STICK_RADIUS := 110.0
const LOOK_SENS := 0.22

var player: Player
var _root: Control
var _stick_touch := -1
var _stick_origin := Vector2.ZERO
var _stick_pos := Vector2.ZERO
var _look_touch := -1
var _look_last := Vector2.ZERO
var _buttons: Array = []   # [{rect: Rect2, action, label, hold, touch}]
var _canvas: Control


static func wanted() -> bool:
	return DisplayServer.is_touchscreen_available() or OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios") \
		or "--touch" in OS.get_cmdline_user_args()


func bind(p: Player) -> void:
	player = p


func _ready() -> void:
	layer = 8
	# Touches also arrive as emulated mouse clicks (needed for menus); stop those from attacking/blocking.
	for a in ["attack_light", "attack_heavy", "block", "lock_on"]:
		for ev in InputMap.action_get_events(a):
			if ev is InputEventMouseButton:
				InputMap.action_erase_event(a, ev)
	_canvas = Control.new()
	_canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_draw_controls)
	add_child(_canvas)
	get_viewport().size_changed.connect(_layout)
	_layout()


func _layout() -> void:
	var s := _canvas.get_viewport_rect().size
	var r := minf(s.y * 0.085, 90.0)
	var br := s - Vector2(r * 1.6, r * 1.7)
	_buttons.clear()
	_add("attack_light", "ATK", br, r * 1.25)
	_add("attack_heavy", "HVY", br + Vector2(-r * 2.6, r * 0.25), r * 0.9)
	_add("dodge", "DODGE", br + Vector2(-r * 0.45, -r * 2.45), r * 0.9)
	_add("jump", "JUMP", br + Vector2(-r * 2.4, -r * 1.75), r * 0.85)
	_add("block", "GUARD", br + Vector2(-r * 4.7, r * 0.25), r * 0.95, true)
	_add("ability_1", "Q", br + Vector2(-r * 4.4, -r * 2.2), r * 0.75)
	_add("ability_2", "E", br + Vector2(-r * 2.0, -r * 4.1), r * 0.75)
	_add("form", "FORM", br + Vector2(r * 0.2, -r * 4.6), r * 0.75)
	_add("lock_on", "LOCK", Vector2(s.x - r * 1.1, r * 2.6), r * 0.7)
	_add("heal", "HEAL", Vector2(s.x - r * 2.8, r * 2.6), r * 0.7)
	_add("pause", "II", Vector2(s.x * 0.5, r * 0.9), r * 0.55)


func _add(action: String, label: String, center: Vector2, radius: float, hold := false) -> void:
	_buttons.append({"c": center, "r": radius, "action": action, "label": label, "hold": hold, "touch": -1})


func _input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		if t.pressed:
			for b in _buttons:
				if b["touch"] == -1 and t.position.distance_to(b["c"]) <= b["r"] * 1.15:
					b["touch"] = t.index
					_press(b, true)
					get_viewport().set_input_as_handled()
					_canvas.queue_redraw()
					return
			var s := _canvas.get_viewport_rect().size
			if t.position.x < s.x * 0.42 and _stick_touch == -1:
				_stick_touch = t.index
				_stick_origin = t.position
				_stick_pos = t.position
			elif _look_touch == -1:
				_look_touch = t.index
				_look_last = t.position
		else:
			for b in _buttons:
				if b["touch"] == t.index:
					b["touch"] = -1
					_press(b, false)
			if t.index == _stick_touch:
				_stick_touch = -1
				_set_move(Vector2.ZERO)
			if t.index == _look_touch:
				_look_touch = -1
		get_viewport().set_input_as_handled()
		_canvas.queue_redraw()
	elif event is InputEventScreenDrag:
		var d := event as InputEventScreenDrag
		if d.index == _stick_touch:
			_stick_pos = d.position
			var v := (_stick_pos - _stick_origin) / STICK_RADIUS
			_set_move(v.limit_length(1.0))
			_canvas.queue_redraw()
		elif d.index == _look_touch:
			if player:
				player.touch_look((d.position - _look_last) * LOOK_SENS)
			_look_last = d.position
		get_viewport().set_input_as_handled()


func _press(b: Dictionary, down: bool) -> void:
	var action: String = b["action"]
	if action == "form":
		if not down or player == null:
			return
		var order := ["base", "black", "devil"]
		action = "mode_" + order[(order.find(player.mode) + 1) % 3]
		_send(action, true)
		_send(action, false)
		return
	if action == "pause":
		if down:
			_send("pause", true)
			_send("pause", false)
		return
	_send(action, down)


func _send(action: String, down: bool) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = down
	ev.strength = 1.0 if down else 0.0
	Input.parse_input_event(ev)


func _set_move(v: Vector2) -> void:
	for pair in [["move_right", maxf(v.x, 0.0)], ["move_left", maxf(-v.x, 0.0)], ["move_back", maxf(v.y, 0.0)], ["move_forward", maxf(-v.y, 0.0)]]:
		if pair[1] > 0.05:
			Input.action_press(pair[0], pair[1])
		else:
			Input.action_release(pair[0])


func _draw_controls() -> void:
	var font := ThemeDB.fallback_font
	for b in _buttons:
		var held: bool = b["touch"] != -1
		var col := Color(1, 1, 1, 0.32 if held else 0.16)
		_canvas.draw_circle(b["c"], b["r"], Color(0, 0, 0, 0.28))
		_canvas.draw_arc(b["c"], b["r"], 0, TAU, 40, col * Color(1, 1, 1, 2.2), 2.5, true)
		if held:
			_canvas.draw_circle(b["c"], b["r"] * 0.92, col)
		var fs := int(clampf(b["r"] * 0.42, 14, 34))
		var w := font.get_string_size(b["label"], HORIZONTAL_ALIGNMENT_CENTER, -1, fs).x
		_canvas.draw_string(font, b["c"] + Vector2(-w * 0.5, fs * 0.35), b["label"], HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.9))
	if _stick_touch != -1:
		_canvas.draw_circle(_stick_origin, STICK_RADIUS, Color(0, 0, 0, 0.22))
		_canvas.draw_arc(_stick_origin, STICK_RADIUS, 0, TAU, 48, Color(1, 1, 1, 0.35), 2.0, true)
		var knob := _stick_origin + (_stick_pos - _stick_origin).limit_length(STICK_RADIUS)
		_canvas.draw_circle(knob, 44, Color(1, 1, 1, 0.35))
	else:
		var s := _canvas.get_viewport_rect().size
		var hint := Vector2(s.x * 0.16, s.y * 0.72)
		_canvas.draw_arc(hint, STICK_RADIUS * 0.8, 0, TAU, 48, Color(1, 1, 1, 0.12), 2.0, true)
		_canvas.draw_string(font, hint + Vector2(-34, 6), "MOVE", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(1, 1, 1, 0.3))
