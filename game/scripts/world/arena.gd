class_name Arena
extends Node3D
## One boss fight: builds the arena, spawns Asta + the boss, owns projectiles/hazards,
## enforces the arena boundary, and reports the result.

signal finished(won: bool)
signal quit_requested

var boss_id := "yuno"
var def: Dictionary = {}
var player: Player
var boss: Boss
var hud: Node
var arena_radius := ArenaBuilder.RADIUS - 1.0
var projectiles: Array[Projectile] = []
var fight_time := 0.0
var info: Dictionary = {}
var _over := false
var _pause_menu: Node


func setup(id: String) -> Arena:
	boss_id = id
	def = Roster.get_boss(id)
	return self


func _ready() -> void:
	GameState.reset_time()
	info = ArenaBuilder.build(self, def.get("arena", "clover_ruins"), Settings.quality)
	Settings.changed.connect(_on_settings_changed)
	player = Player.new()
	player.arena = self
	player.position = Vector3(0, 0.1, 15)
	add_child(player)
	boss = Boss.new().setup(def, self)
	boss.position = Vector3(0, 0.1, -10)
	add_child(boss)
	boss.rotation.y = PI  # face the player
	boss.player = player
	boss.died.connect(_on_boss_died)
	player.died.connect(_on_player_died)
	hud = load("res://scripts/ui/hud.gd").new()
	add_child(hud)
	hud.call("bind", self)
	_pause_menu = load("res://scripts/ui/pause_menu.gd").new()
	add_child(_pause_menu)
	_pause_menu.connect("resume", _on_resume)
	_pause_menu.connect("restart", func(): _leave(); get_parent().call("start_fight", boss_id))
	_pause_menu.connect("quit", func(): _leave(); quit_requested.emit())
	Sfx.play("transform", null, -8.0)
	if load("res://scripts/ui/touch_controls.gd").wanted():
		touch = load("res://scripts/ui/touch_controls.gd").new()
		add_child(touch)
		touch.call("bind", player)
	_maybe_play_intro()


var in_cutscene := false
var touch: CanvasLayer


func _maybe_play_intro() -> void:
	var id: String = def.get("intro_cutscene", "")
	if id == "" or not Settings.intro_cutscenes or not FileAccess.file_exists(Cutscene.path_for(id)):
		return
	var cs := Cutscene.new()
	if not cs.setup(self, id):
		return
	in_cutscene = true
	player.frozen = true
	boss.set("_intro_time", 1e9)
	hud.visible = false
	if touch:
		touch.visible = false
	cs.finished.connect(func():
		if touch:
			touch.visible = true
		in_cutscene = false
		player.frozen = false
		hud.visible = true
		if is_instance_valid(boss):
			boss.set("_intro_time", boss.state_t + 0.6))
	add_child(cs)


func _leave() -> void:
	get_tree().paused = false
	GameState.reset_time()


func _on_settings_changed() -> void:
	var env: Environment = info.get("env")
	if env:
		ArenaBuilder.apply_quality(env, ArenaBuilder.THEMES.get(def.get("arena", ""), ArenaBuilder.THEMES["clover_ruins"]), Settings.quality)
	if player and player.camera:
		player.camera.fov = Settings.fov


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and not _over and not in_cutscene:
		_toggle_pause()
		get_viewport().set_input_as_handled()


func _toggle_pause() -> void:
	var p := not get_tree().paused
	get_tree().paused = p
	GameState.reset_time()
	_pause_menu.call("set_open", p)
	if not Settings.is_headless():
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if p else Input.MOUSE_MODE_CAPTURED


func _on_resume() -> void:
	if get_tree().paused:
		_toggle_pause()


func _physics_process(delta: float) -> void:
	if not _over and not in_cutscene:
		fight_time += delta
	for body in [player, boss]:
		if body and is_instance_valid(body):
			var flat := Vector2(body.global_position.x, body.global_position.z)
			if flat.length() > arena_radius:
				flat = flat.normalized() * arena_radius
				body.global_position.x = flat.x
				body.global_position.z = flat.y
			if body.global_position.y < -5.0:
				body.global_position = Vector3(flat.x, 1.0, flat.y)


# ---------------------------------------------------------------- spawning

func spawn_projectile(pos: Vector3, vel: Vector3, dmg: float, radius: float, elem: String) -> Projectile:
	var p := Projectile.new().setup(self, pos, vel, dmg, radius, elem, false)
	add_child(p)
	projectiles.append(p)
	return p


func spawn_player_wave(pos: Vector3, dir: Vector3, speed: float, dmg: float, poise: float, radius: float, mode: String) -> Projectile:
	var p := Projectile.new().setup(self, pos, dir * speed, dmg, radius, "devil" if mode == "devil" else "anti", true)
	p.poise = poise
	p.life = 1.6
	add_child(p)
	return p


func spawn_hazard(kind: String, pos: Vector3, opts: Dictionary) -> Hazard:
	var h := Hazard.new()
	h.arena = self
	h.kind = kind
	for k in opts:
		h.set(k, opts[k])
	add_child(h)
	h.global_position = pos
	return h


func unregister_projectile(p: Projectile) -> void:
	projectiles.erase(p)


func nullify_projectiles_near(pos: Vector3, r: float) -> int:
	var n := 0
	for p in projectiles.duplicate():
		if is_instance_valid(p) and not p.from_player and not p.reflected and p.global_position.distance_to(pos) <= r + p.radius:
			p.nullify()
			n += 1
	return n


func nullify_projectiles_in_arc(origin: Vector3, fwd: Vector3, r: float, arc_deg: float) -> int:
	var n := 0
	for p in projectiles.duplicate():
		if not is_instance_valid(p) or p.from_player or p.reflected:
			continue
		var to: Vector3 = p.global_position - origin
		if to.length() <= r + p.radius and (arc_deg >= 360.0 or rad_to_deg(fwd.angle_to(to.normalized())) <= arc_deg * 0.5):
			p.nullify()
			n += 1
	return n


func damage_number(pos: Vector3, amount: float, crit: bool) -> void:
	VFX.float_text(self, pos + Vector3(0, 0.4, 0), str(int(round(amount))), Color(1.0, 0.85, 0.3) if crit else Color(1, 1, 1), 72 if crit else 52)


# ---------------------------------------------------------------- outcome

func _on_boss_died() -> void:
	if _over:
		return
	_over = true
	player.invuln = 99.0
	Sfx.play("victory", null, -2.0)
	GameState.hitstop(0.4, 0.15)
	for p in projectiles.duplicate():
		if is_instance_valid(p):
			p.nullify()
	await get_tree().create_timer(3.0, false).timeout
	_finish(true)


func _on_player_died() -> void:
	if _over:
		return
	_over = true
	Sfx.play("defeat", null, -2.0)
	await get_tree().create_timer(2.8, false).timeout
	_finish(false)


func _finish(won: bool) -> void:
	var stats: Dictionary = player.stats.duplicate()
	stats["boss_damage_pct"] = 1.0 - boss.hp_ratio()
	stats["mode"] = player.mode
	GameState.record_fight(boss_id, won, fight_time, stats)
	if not Settings.is_headless():
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	finished.emit(won)
