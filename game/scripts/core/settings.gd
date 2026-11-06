extends Node
## Persistent user settings + input bindings. Autoloaded as `Settings`.
## Display settings are tuned for high-refresh play: uncapped/240 FPS, VSync off,
## exclusive fullscreen (needed on Windows to actually hit 240 Hz).

signal changed

const PATH := "user://settings.cfg"
const SAVED_KEYS := [
	"max_fps", "vsync", "fullscreen", "fov", "mouse_sensitivity", "invert_y",
	"quality", "render_scale", "show_fps", "master_volume", "backend_url", "difficulty", "intro_cutscenes",
]
const FPS_OPTIONS := [60, 120, 144, 165, 240, 360, 0]
const QUALITY_OPTIONS := ["low", "medium", "high", "ultra"]
const DIFFICULTIES := {
	"normal": {"label": "Magic Knight", "boss_hp": 1.0, "boss_dmg": 1.0, "boss_speed": 1.0},
	"hard": {"label": "Vice Captain", "boss_hp": 1.25, "boss_dmg": 1.35, "boss_speed": 1.08},
	"captain": {"label": "Captain", "boss_hp": 1.5, "boss_dmg": 1.7, "boss_speed": 1.16},
}

var max_fps: int = 240
var vsync: bool = false
var fullscreen: bool = true
var fov: float = 90.0
var mouse_sensitivity: float = 0.09  # degrees per pixel
var invert_y: bool = false
var quality: String = "high"
var render_scale: float = 1.0
var show_fps: bool = true
var master_volume: float = 0.8
var backend_url: String = "http://127.0.0.1:8765"
var difficulty: String = "normal"
var intro_cutscenes: bool = false  # off until hero character models land (see studio hub)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	register_input()
	load_settings()
	apply()


func is_headless() -> bool:
	return DisplayServer.get_name() == "headless"


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) != OK:
		return
	for k in SAVED_KEYS:
		set(k, cfg.get_value("settings", k, get(k)))
	if not QUALITY_OPTIONS.has(quality):
		quality = "high"
	if not DIFFICULTIES.has(difficulty):
		difficulty = "normal"


func save_settings() -> void:
	var cfg := ConfigFile.new()
	for k in SAVED_KEYS:
		cfg.set_value("settings", k, get(k))
	cfg.save(PATH)


func apply() -> void:
	Engine.max_fps = max_fps
	if not is_headless():
		DisplayServer.window_set_vsync_mode(
			DisplayServer.VSYNC_ADAPTIVE if vsync else DisplayServer.VSYNC_DISABLED)
		var want := DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN if fullscreen else DisplayServer.WINDOW_MODE_WINDOWED
		if DisplayServer.window_get_mode() != want:
			DisplayServer.window_set_mode(want)
		var vp := get_viewport()
		if vp:
			vp.scaling_3d_scale = render_scale
			vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2 if render_scale < 0.99 else Viewport.SCALING_3D_MODE_BILINEAR
			vp.use_taa = quality == "ultra" and render_scale >= 0.99
			vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if quality != "ultra" else Viewport.SCREEN_SPACE_AA_DISABLED
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(master_volume, 0.0001)))
	changed.emit()


func difficulty_data() -> Dictionary:
	return DIFFICULTIES.get(difficulty, DIFFICULTIES["normal"])


# ---------------------------------------------------------------- input

func _key(code: Key) -> InputEventKey:
	var e := InputEventKey.new()
	e.physical_keycode = code
	return e


func _mouse(b: MouseButton) -> InputEventMouseButton:
	var e := InputEventMouseButton.new()
	e.button_index = b
	return e


func _joy(b: JoyButton) -> InputEventJoypadButton:
	var e := InputEventJoypadButton.new()
	e.button_index = b
	return e


func _axis(a: JoyAxis, v: float) -> InputEventJoypadMotion:
	var e := InputEventJoypadMotion.new()
	e.axis = a
	e.axis_value = v
	return e


func register_input() -> void:
	var map := {
		"move_forward": [_key(KEY_W), _axis(JOY_AXIS_LEFT_Y, -1.0)],
		"move_back": [_key(KEY_S), _axis(JOY_AXIS_LEFT_Y, 1.0)],
		"move_left": [_key(KEY_A), _axis(JOY_AXIS_LEFT_X, -1.0)],
		"move_right": [_key(KEY_D), _axis(JOY_AXIS_LEFT_X, 1.0)],
		"look_left": [_axis(JOY_AXIS_RIGHT_X, -1.0)],
		"look_right": [_axis(JOY_AXIS_RIGHT_X, 1.0)],
		"look_up": [_axis(JOY_AXIS_RIGHT_Y, -1.0)],
		"look_down": [_axis(JOY_AXIS_RIGHT_Y, 1.0)],
		"jump": [_key(KEY_SPACE), _joy(JOY_BUTTON_A)],
		"dodge": [_key(KEY_SHIFT), _joy(JOY_BUTTON_B)],
		"sprint": [_key(KEY_CTRL), _joy(JOY_BUTTON_LEFT_STICK)],
		"attack_light": [_mouse(MOUSE_BUTTON_LEFT), _joy(JOY_BUTTON_RIGHT_SHOULDER)],
		"attack_heavy": [_key(KEY_R), _mouse(MOUSE_BUTTON_XBUTTON1), _axis(JOY_AXIS_TRIGGER_RIGHT, 1.0)],
		"block": [_mouse(MOUSE_BUTTON_RIGHT), _joy(JOY_BUTTON_LEFT_SHOULDER)],
		"ability_1": [_key(KEY_Q), _joy(JOY_BUTTON_X)],
		"ability_2": [_key(KEY_E), _joy(JOY_BUTTON_Y)],
		"mode_base": [_key(KEY_1), _joy(JOY_BUTTON_DPAD_LEFT)],
		"mode_black": [_key(KEY_2), _joy(JOY_BUTTON_DPAD_UP)],
		"mode_devil": [_key(KEY_3), _joy(JOY_BUTTON_DPAD_RIGHT)],
		"heal": [_key(KEY_H), _key(KEY_F), _joy(JOY_BUTTON_DPAD_DOWN)],
		"lock_on": [_key(KEY_T), _mouse(MOUSE_BUTTON_MIDDLE), _joy(JOY_BUTTON_RIGHT_STICK)],
		"pause": [_key(KEY_ESCAPE), _joy(JOY_BUTTON_START)],
	}
	for action in map:
		if not InputMap.has_action(action):
			InputMap.add_action(action, 0.25)
		InputMap.action_erase_events(action)
		for ev in map[action]:
			InputMap.action_add_event(action, ev)
