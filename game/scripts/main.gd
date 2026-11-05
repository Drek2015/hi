extends Node
## Screen flow: title -> opponent select -> fight -> results.
## Command-line (after `--`): --boss=<id> jumps straight into a fight; --autoplay lets a bot play;
## --capture=<dir> with --capture-at=<s,...> saves screenshots (used by tools/capture.sh).

var current: Node
var _args: Dictionary = {}


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv: PackedStringArray = a.trim_prefix("--").split("=", true, 1)
		_args[kv[0]] = kv[1] if kv.size() > 1 else "true"
	if _args.has("quality"):
		Settings.quality = _args["quality"]
	if _args.has("boss"):
		start_fight(_args["boss"])
	else:
		show_main_menu()
	if _args.has("capture"):
		_capture_loop()


func _swap(n: Node) -> void:
	if current and is_instance_valid(current):
		current.queue_free()
	get_tree().paused = false
	GameState.reset_time()
	current = n
	add_child(n)


func show_main_menu() -> void:
	_mouse_visible()
	var m: Node = load("res://scripts/ui/main_menu.gd").new()
	m.connect("fight", show_boss_select)
	m.connect("grimoire", func(): _simple("res://scripts/ui/grimoire_menu.gd"))
	m.connect("settings", func(): _simple("res://scripts/ui/settings_menu.gd"))
	m.connect("quit", func(): get_tree().quit())
	_swap(m)


func _simple(path: String) -> void:
	var s: Node = load(path).new()
	s.connect("back", show_main_menu)
	_swap(s)


func show_boss_select() -> void:
	_mouse_visible()
	var s: Node = load("res://scripts/ui/boss_select.gd").new()
	s.connect("start", start_fight)
	s.connect("back", show_main_menu)
	_swap(s)


func start_fight(id: String) -> void:
	if Roster.get_boss(id).is_empty():
		push_error("Unknown boss '%s'" % id)
		show_boss_select()
		return
	GameState.selected_boss = id
	var a := Arena.new().setup(id)
	a.finished.connect(func(_won): show_results())
	a.quit_requested.connect(show_boss_select)
	_swap(a)
	if _args.has("autoplay"):
		a.player.autopilot = load("res://tests/bot.gd").new()
	if _args.has("near"):
		a.player.position = Vector3(0, 0.1, -3.5)
		a.boss.set("_intro_time", 99.0)
	if _args.has("noviewmodel"):
		a.player.viewmodel.visible = false
	if _args.has("fov"):
		Settings.fov = float(_args["fov"])


func show_results() -> void:
	_mouse_visible()
	var r: Node = load("res://scripts/ui/result_screen.gd").new()
	r.connect("retry", func(): start_fight(GameState.selected_boss))
	r.connect("select", show_boss_select)
	r.connect("menu", show_main_menu)
	_swap(r)


func _mouse_visible() -> void:
	if not Settings.is_headless():
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _capture_loop() -> void:
	var dir: String = _args["capture"]
	DirAccess.make_dir_recursive_absolute(dir)
	var times: Array = []
	for t in str(_args.get("capture-at", "3")).split(","):
		times.append(float(t))
	var elapsed := 0.0
	for i in times.size():
		await get_tree().create_timer(times[i] - elapsed, true, false, true).timeout
		elapsed = times[i]
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		img.save_png("%s/%s_%02d.png" % [dir, _args.get("boss", "menu"), i])
		print("captured ", i, " fps=", Engine.get_frames_per_second())
	get_tree().quit()
