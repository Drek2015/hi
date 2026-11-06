class_name Player
extends CharacterBody3D
## First-person Asta. Soulslike rules: stamina-gated actions, i-frame dodges, perfect parries,
## input buffering, poise/hyper-armor, heal charges, and three switchable forms (see AstaModes).

signal died
signal mode_changed(mode: String)
signal message(text: String, color: Color)
signal took_damage(amount: float)

const GRAVITY := 24.0
const JUMP_VELOCITY := 8.2
const WALK_SPEED := 6.2
const SPRINT_MULT := 1.5
const ACCEL := 70.0
const AIR_ACCEL := 16.0
const FRICTION := 60.0
const PARRY_WINDOW := 0.18
const BUFFER_TIME := 0.3
const COMBO_RESET := 0.7
const HEAL_CHARGES := 4
const HEAL_AMOUNT := 0.4
const EYE_HEIGHT := 1.62
const RADIUS := 0.42

var arena: Node = null
## Optional scripted controller (tests / attract mode). Must implement get_input(player) -> Dictionary.
var autopilot: Object = null
## Tests only: HP never drops below 1.
var test_god := false
## True while a cutscene plays: no input, no movement.
var frozen := false

var max_hp := 800.0
var hp := 800.0
var max_stamina := 100.0
var stamina := 100.0
var gauge := 0.0
var mode := "base"
var heals := HEAL_CHARGES
var state := "free"   # free | attack | dodge | heal | stagger | transform | dead
var state_t := 0.0
var invuln := 0.0
var blocking := false
var block_t := 0.0
var lock_target: Node3D = null
var cooldowns := {"q": 0.0, "e": 0.0}
var stats := {"parries": 0, "damage_taken": 0.0, "damage_dealt": 0.0, "nullified": 0, "dodges": 0}

var head: Node3D
var camera: Camera3D
var viewmodel: ViewModel

var _yaw := 0.0
var _pitch := 0.0
var _look_delta := Vector2.ZERO
var _combo := 0
var _combo_timer := 0.0
var _buffer := ""
var _buffer_t := 0.0
var _attack: Dictionary = {}
var _hits_done := 0
var _dodge_dir := Vector3.ZERO
var _dodge_speed := 0.0
var _stamina_delay := 0.0
var _jumps_left := 1
var _shake := 0.0
var _fov_kick := 0.0
var _was_on_floor := true
var _fall_speed := 0.0
var _heal_applied := false
var _external := Vector3.ZERO
var _step_t := 0.0
var _input: Dictionary = {}


func _ready() -> void:
	max_hp = GameState.max_hp()
	hp = max_hp
	max_stamina = GameState.max_stamina()
	stamina = max_stamina
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = RADIUS
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	add_child(shape)
	floor_snap_length = 0.3
	head = Node3D.new()
	head.position.y = EYE_HEIGHT
	add_child(head)
	camera = Camera3D.new()
	camera.near = 0.04
	camera.far = 600.0
	camera.fov = Settings.fov
	camera.current = true
	head.add_child(camera)
	viewmodel = ViewModel.new()
	camera.add_child(viewmodel)
	_yaw = rotation.y
	if not Settings.is_headless():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func mode_data() -> Dictionary:
	return AstaModes.get_mode(mode)


# ---------------------------------------------------------------- input layer

func _gather_input() -> void:
	if autopilot:
		_input = autopilot.get_input(self)
		return
	var pressed := []
	for a in ["jump", "dodge", "attack_light", "attack_heavy", "ability_1", "ability_2",
			"mode_base", "mode_black", "mode_devil", "heal", "lock_on"]:
		if Input.is_action_just_pressed(a):
			pressed.append(a)
	_input = {
		"move": Input.get_vector("move_left", "move_right", "move_forward", "move_back"),
		"pressed": pressed,
		"block": Input.is_action_pressed("block"),
		"sprint": Input.is_action_pressed("sprint"),
	}


func _pressed(a: String) -> bool:
	return _input.get("pressed", []).has(a)


func _unhandled_input(event: InputEvent) -> void:
	if frozen or state == "dead" or Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		return
	if event is InputEventMouseMotion:
		var rel: Vector2 = event.screen_relative
		var s := Settings.mouse_sensitivity * (0.35 if lock_target else 1.0)
		_yaw -= deg_to_rad(rel.x * s)
		_pitch -= deg_to_rad(rel.y * s) * (-1.0 if Settings.invert_y else 1.0)
		_pitch = clampf(_pitch, deg_to_rad(-85), deg_to_rad(85))
		_look_delta += rel


## Touch-screen look (TouchControls): rel is in screen pixels, already sensitivity-scaled.
func touch_look(rel: Vector2) -> void:
	if frozen or state == "dead":
		return
	var k := 0.35 if lock_target else 1.0
	_yaw -= deg_to_rad(rel.x) * k
	_pitch = clampf(_pitch - deg_to_rad(rel.y) * k * (-1.0 if Settings.invert_y else 1.0), deg_to_rad(-85), deg_to_rad(85))
	_look_delta += rel * 4.0


# ---------------------------------------------------------------- frame update (camera)

func _process(delta: float) -> void:
	var stick := Input.get_vector("look_left", "look_right", "look_up", "look_down")
	if stick.length() > 0.0 and state != "dead":
		_yaw -= stick.x * delta * 3.2
		_pitch = clampf(_pitch - stick.y * delta * 2.4 * (-1.0 if Settings.invert_y else 1.0), deg_to_rad(-85), deg_to_rad(85))
		_look_delta += stick * 14.0
	if lock_target and is_instance_valid(lock_target) and state != "dead":
		var tp: Vector3 = lock_target.call("aim_point") if lock_target.has_method("aim_point") else lock_target.global_position
		var to := tp - camera.global_position
		var want_yaw := atan2(-to.x, -to.z)
		var want_pitch := atan2(to.y, Vector2(to.x, to.z).length())
		var k := 1.0 - exp(-10.0 * delta)
		_yaw = lerp_angle(_yaw, want_yaw, k)
		_pitch = lerpf(_pitch, clampf(want_pitch, -0.6, 0.5), k)
	rotation.y = _yaw
	head.rotation.x = _pitch
	# Camera shake + FOV kick for impacts and dashes.
	_shake = move_toward(_shake, 0.0, delta * 2.8)
	var s := _shake * _shake
	camera.h_offset = randf_range(-1, 1) * 0.08 * s
	camera.v_offset = randf_range(-1, 1) * 0.08 * s
	camera.rotation.z = randf_range(-1, 1) * 0.02 * s
	_fov_kick = move_toward(_fov_kick, 0.0, delta * 30.0)
	camera.fov = Settings.fov + _fov_kick + (6.0 if mode == "devil" else (3.0 if mode == "black" else 0.0))
	# Keep the viewmodel the same on-screen size at any FOV setting.
	var k := tan(deg_to_rad(Settings.fov) * 0.5)
	viewmodel.scale = Vector3(k, k, 1.0)
	var flat_speed := Vector2(velocity.x, velocity.z).length()
	viewmodel.update_motion(delta, _look_delta, flat_speed, is_on_floor())
	_look_delta = Vector2.ZERO


func add_shake(amount: float) -> void:
	_shake = clampf(maxf(_shake, amount), 0.0, 1.2)


# ---------------------------------------------------------------- simulation

func _physics_process(delta: float) -> void:
	if frozen:
		velocity = Vector3(0, velocity.y - GRAVITY * delta, 0)
		move_and_slide()
		return
	_gather_input()
	state_t += delta
	invuln = maxf(invuln - delta, 0.0)
	_buffer_t -= delta
	if _buffer_t <= 0.0:
		_buffer = ""
	_combo_timer -= delta
	if _combo_timer <= 0.0 and state != "attack":
		_combo = 0
	for k in cooldowns:
		cooldowns[k] = maxf(cooldowns[k] - delta, 0.0)

	if state == "dead":
		velocity.x = move_toward(velocity.x, 0, FRICTION * delta)
		velocity.z = move_toward(velocity.z, 0, FRICTION * delta)
		velocity.y -= GRAVITY * delta
		move_and_slide()
		return

	_update_gauge(delta)
	_handle_actions()
	_update_state(delta)
	_update_movement(delta)
	_update_stamina(delta)
	_update_viewmodel_hold()


func _update_gauge(delta: float) -> void:
	var drain: float = mode_data()["drain"]
	if drain > 0.0:
		gauge -= drain * delta / GameState.gauge_mult() * (0.0 if state == "transform" else 1.0)
		if gauge <= 0.0:
			gauge = 0.0
			_set_mode("base", true)
			message.emit("ANTI-MAGIC DEPLETED", Color(0.8, 0.8, 0.85))


func add_gauge(v: float) -> void:
	gauge = clampf(gauge + v * GameState.gauge_mult(), 0.0, 100.0)


func _handle_actions() -> void:
	if _pressed("lock_on"):
		_toggle_lock()
	var free := state == "free"
	var can_cancel: bool = state == "attack" and state_t >= float(_attack.get("cancel", 99.0))
	# Buffer combat inputs so presses during an animation are never dropped.
	for a in ["attack_light", "attack_heavy", "dodge", "ability_1", "ability_2", "heal"]:
		if _pressed(a):
			_buffer = a
			_buffer_t = BUFFER_TIME
	for m in ["mode_base", "mode_black", "mode_devil"]:
		if _pressed(m) and (free or can_cancel):
			_try_mode(m.trim_prefix("mode_"))
	if _pressed("jump") and (free or can_cancel):
		if is_on_floor() or _jumps_left > 0:
			if not is_on_floor():
				_jumps_left -= 1
				VFX.burst(arena, global_position, Color(0.05, 0.05, 0.06), 16, 4.0, 0.2)
			velocity.y = JUMP_VELOCITY
			if state == "attack":
				_end_attack()
	if _buffer == "" or not (free or can_cancel or (state == "dodge" and state_t > 0.18)):
		return
	var act := _buffer
	match act:
		"dodge":
			if _try_dodge():
				_buffer = ""
		"attack_light":
			if state != "dodge" or state_t > 0.18:
				_buffer = ""
				var chain: Array = mode_data()["light"]
				if _combo >= chain.size():
					_combo = 0
				var a: Dictionary = chain[_combo]
				if _spend_stamina(a["stamina"]):
					_combo += 1
					_start_attack(a, "light")
		"attack_heavy":
			_buffer = ""
			var h: Dictionary = mode_data()["heavy"]
			if _spend_stamina(h["stamina"]):
				_combo = 0
				_start_attack(h, "heavy")
		"ability_1", "ability_2":
			_buffer = ""
			_try_ability("q" if act == "ability_1" else "e")
		"heal":
			_buffer = ""
			if state == "free" and heals > 0 and hp < max_hp:
				heals -= 1
				_set_state("heal")
				_heal_applied = false
				viewmodel.play("heal")
				Sfx.play("heal", null, -6.0)


func _spend_stamina(cost: float) -> bool:
	if stamina <= 0.0:
		message.emit("OUT OF STAMINA", Color(0.6, 0.9, 0.5))
		return false
	stamina -= cost
	_stamina_delay = 0.55
	return true


func _set_state(s: String) -> void:
	state = s
	state_t = 0.0


func _start_attack(a: Dictionary, kind: String) -> void:
	var spd: float = mode_data()["atk_speed"]
	var info := ViewModel.clip_info(a["clip"])
	_attack = a.duplicate()
	_attack["kind"] = kind
	_attack["length"] = float(info.get("length", 0.6)) / spd
	_attack["hits"] = []
	for h in info.get("hit", [0.25]):
		_attack["hits"].append(float(h) / spd)
	_attack["cancel"] = float(info.get("cancel", 0.4)) / spd
	_hits_done = 0
	_set_state("attack")
	viewmodel.play(a["clip"], spd)
	_combo_timer = COMBO_RESET + _attack["length"]


func _end_attack() -> void:
	_attack = {}
	_set_state("free")


func _try_dodge() -> bool:
	var md := mode_data()
	if not is_on_floor() and not md["air_dash"]:
		return false
	if not _spend_stamina(md["dodge_cost"]):
		return false
	var mv: Vector2 = _input.get("move", Vector2.ZERO)
	var dir := (transform.basis * Vector3(mv.x, 0, mv.y))
	dir.y = 0
	if dir.length() < 0.1:
		dir = transform.basis.z  # back-step
	_dodge_dir = dir.normalized()
	_dodge_speed = md["dodge_speed"]
	invuln = md["iframes"]
	_attack = {}
	_set_state("dodge")
	stats["dodges"] += 1
	viewmodel.play("dodge", 1.0)
	_fov_kick = 6.0 if mode != "base" else 3.0
	Sfx.play("dodge", null, -5.0)
	if mode != "base":
		VFX.burst(arena, global_position + Vector3(0, 1, 0), Color(0.04, 0.04, 0.05) if mode == "black" else Color(0.5, 0.02, 0.02), 24, 6.0, 0.25)
	return true


func _try_mode(m: String) -> void:
	if m == mode:
		return
	var md := AstaModes.get_mode(m)
	if gauge < md["min_gauge"]:
		message.emit("%s needs %d%% anti-magic" % [md["name"], int(md["min_gauge"])], Color(0.85, 0.85, 0.9))
		return
	gauge -= md["enter_cost"]
	_set_mode(m, false)


func _set_mode(m: String, silent: bool) -> void:
	mode = m
	viewmodel.set_mode(m)
	mode_changed.emit(m)
	_jumps_left = mode_data()["jumps"] - 1
	if silent:
		return
	_attack = {}
	_set_state("transform")
	invuln = 0.6
	viewmodel.play("transform")
	add_shake(0.7)
	_fov_kick = 10.0
	Sfx.play("transform", null, -2.0)
	var col: Color = mode_data()["color"]
	VFX.shockwave(arena, global_position + Vector3(0, 1, 0), "anti" if m != "devil" else "blood", 7.0, 0.5)
	VFX.burst(arena, global_position + Vector3(0, 1, 0), col, 60, 10.0, 0.3, 0.9)
	VFX.flash(arena, global_position + Vector3(0, 1.5, 0), Color(1, 1, 1) if m != "devil" else Color(1, 0.2, 0.1), 8.0, 12.0, 0.5)
	if arena and arena.has_method("nullify_projectiles_near"):
		var n: int = arena.nullify_projectiles_near(global_position, 7.0)
		if n > 0:
			stats["nullified"] += n
	message.emit(mode_data()["name"].to_upper(), col.lightened(0.3))


func _try_ability(slot: String) -> void:
	var ab: Dictionary = mode_data()[slot]
	if cooldowns[slot] > 0.0:
		return
	if gauge < ab["cost"]:
		message.emit("Not enough anti-magic for %s" % ab["name"], Color(0.8, 0.8, 0.85))
		return
	gauge -= ab["cost"]
	cooldowns[slot] = ab["cooldown"]
	var a := ab.duplicate()
	a["ab_kind"] = ab["kind"]
	a["range"] = a.get("radius", 3.5)
	a["arc"] = 360.0 if ab["kind"] in ["spin", "slam"] else 90.0
	_start_attack(a, "ability")
	message.emit(ab["name"].to_upper(), mode_data()["color"].lightened(0.4))
	if ab["kind"] == "dash_strike":
		invuln = maxf(invuln, ab["time"] + 0.1)


func _update_state(delta: float) -> void:
	match state:
		"attack":
			var hits: Array = _attack.get("hits", [])
			while _hits_done < hits.size() and state_t >= hits[_hits_done]:
				_hits_done += 1
				_do_hit()
			if state == "attack" and state_t >= _attack.get("length", 0.5):
				_end_attack()
		"dodge":
			if state_t >= mode_data()["dodge_time"]:
				_set_state("free")
		"heal":
			if not _heal_applied and state_t >= 0.45:
				_heal_applied = true
				hp = minf(hp + max_hp * HEAL_AMOUNT, max_hp)
				VFX.burst(arena, global_position + Vector3(0, 1.2, 0), Color(0.5, 1.0, 0.5), 40, 3.0, 0.15, 1.0)
			if state_t >= 0.9:
				_set_state("free")
		"stagger":
			if state_t >= 0.55:
				_set_state("free")
		"transform":
			if state_t >= 0.65:
				_set_state("free")
	blocking = _input.get("block", false) and state == "free" and stamina > 0.0
	if blocking:
		block_t += delta
	else:
		block_t = 0.0


func _update_viewmodel_hold() -> void:
	if blocking:
		viewmodel.set_hold("block")
	elif state == "free" and _input.get("sprint", false) and is_on_floor() and velocity.length() > 7.0:
		viewmodel.set_hold("run")
	else:
		viewmodel.set_hold("idle")


func _update_movement(delta: float) -> void:
	var md := mode_data()
	var on_floor := is_on_floor()
	if on_floor:
		_jumps_left = md["jumps"] - 1
		if not _was_on_floor and _fall_speed > 6.0:
			viewmodel.land(_fall_speed / 18.0)
			add_shake(clampf(_fall_speed / 40.0, 0.0, 0.4))
			Sfx.play("step", global_position, -2.0)
	_fall_speed = -velocity.y if not on_floor else 0.0
	_was_on_floor = on_floor
	if not on_floor and state != "dodge":
		velocity.y -= GRAVITY * delta

	if state == "dodge":
		var f := state_t / float(md["dodge_time"])
		var spd := _dodge_speed * (1.0 - f * f * 0.7)
		velocity.x = _dodge_dir.x * spd
		velocity.z = _dodge_dir.z * spd
		if not on_floor:
			velocity.y = maxf(velocity.y, 0.0)
	elif state == "attack" and _attack.get("ab_kind", "") == "dash_strike" and state_t < float(_attack.get("time", 0.25)) + 0.12:
		var fwd := -transform.basis.z
		var dash_spd: float = _attack["distance"] / maxf(float(_attack["time"]), 0.05)
		velocity.x = fwd.x * dash_spd
		velocity.z = fwd.z * dash_spd
		_dash_strike_tick()
	else:
		var mv: Vector2 = _input.get("move", Vector2.ZERO)
		var dir := (transform.basis * Vector3(mv.x, 0, mv.y))
		dir.y = 0
		var speed := WALK_SPEED * float(md["move"])
		if _input.get("sprint", false) and stamina > 0.0 and state == "free" and not blocking:
			speed *= SPRINT_MULT
			stamina -= 14.0 * delta
			_stamina_delay = 0.4
		match state:
			"attack": speed *= 0.3
			"heal": speed *= 0.45
			"stagger", "transform": speed *= 0.1
		if blocking:
			speed *= 0.5
		var target := dir * speed
		# Lunge into attacks for weight; stronger when locked on and the boss is a step away.
		if state == "attack" and state_t < (_attack.get("hits", [0.2])[0] if not _attack.get("hits", []).is_empty() else 0.2):
			var lunge: float = _attack.get("lunge", 0.0)
			if lock_target and is_instance_valid(lock_target):
				var d := global_position.distance_to(lock_target.global_position)
				lunge *= clampf((d - 2.2) / 2.5, 0.0, 1.6)
			target += -transform.basis.z * lunge
		var acc := ACCEL if on_floor else AIR_ACCEL
		var horiz := Vector3(velocity.x, 0, velocity.z)
		if target.length() > 0.01:
			horiz = horiz.move_toward(target, acc * delta)
		else:
			horiz = horiz.move_toward(Vector3.ZERO, (FRICTION if on_floor else AIR_ACCEL * 0.5) * delta)
		velocity.x = horiz.x
		velocity.z = horiz.z
		if on_floor and horiz.length() > 1.0:
			_step_t += delta * horiz.length() * 0.38
			if _step_t > 1.0:
				_step_t = 0.0
				Sfx.play("step", global_position, -14.0, 0.2)
	velocity += _external
	_external = _external.move_toward(Vector3.ZERO, 40.0 * delta)
	move_and_slide()


func push(v: Vector3) -> void:
	if mode_data()["hyper_armor"]:
		v *= 0.35
	_external += v


func _update_stamina(delta: float) -> void:
	_stamina_delay -= delta
	if _stamina_delay <= 0.0 and state != "attack" and state != "dodge":
		stamina = minf(stamina + GameState.stamina_regen() * (0.4 if blocking else 1.0) * delta, max_stamina)


# ---------------------------------------------------------------- dealing damage

func _dmg_scale() -> float:
	return float(mode_data()["dmg"]) * GameState.damage_mult()


func _do_hit() -> void:
	if arena == null:
		return
	var a := _attack
	var ab_kind: String = a.get("ab_kind", "")
	if ab_kind == "wave":
		_spawn_waves(a)
		return
	if ab_kind == "dash_strike":
		return  # damage handled during the dash
	var range_m: float = a.get("range", 3.0)
	var arc: float = a.get("arc", 120.0)
	var origin := global_position + Vector3(0, 1.1, 0)
	var fwd := -transform.basis.z
	# Anti-magic: the blade cuts any spell it touches.
	var n: int = arena.nullify_projectiles_in_arc(origin, fwd, range_m + 0.8, arc + 20.0)
	if n > 0:
		stats["nullified"] += n
		add_gauge(6.0 * n)
		Sfx.play("nullify", origin, -3.0)
	if ab_kind == "slam" or ab_kind == "spin":
		var col := Color(0.03, 0.03, 0.04) if mode != "devil" else Color(0.6, 0.02, 0.02)
		VFX.shockwave(arena, global_position + Vector3(0, 0.3, 0), "anti" if mode != "devil" else "blood", range_m, 0.35)
		VFX.burst(arena, global_position + Vector3(0, 0.4, 0), col, 50, 12.0, 0.3)
		if ab_kind == "slam":
			add_shake(1.0)
			Sfx.play("explode", global_position, 0.0)
			arena.nullify_projectiles_near(global_position, range_m)
	var boss: Node = arena.get("boss")
	if boss == null or not is_instance_valid(boss) or not boss.call("is_alive"):
		return
	var to: Vector3 = boss.global_position - global_position
	to.y = 0
	var dist := to.length() - float(boss.get("radius"))
	var ang := rad_to_deg(fwd.angle_to(to.normalized())) if to.length() > 0.01 else 0.0
	var vertical_ok: bool = absf(boss.global_position.y - global_position.y) < 3.5 * float(boss.get("height_scale"))
	if dist <= range_m and ang <= arc * 0.5 and vertical_ok:
		var dmg: float = a["dmg"] * _dmg_scale()
		var hit_pos: Vector3 = boss.call("aim_point")
		var res: Dictionary = boss.call("take_damage", dmg, a.get("poise", 20.0), hit_pos)
		_on_hit_landed(res, hit_pos, a)


func _on_hit_landed(res: Dictionary, hit_pos: Vector3, a: Dictionary) -> void:
	var dealt: float = res.get("damage", 0.0)
	if dealt <= 0.0:
		return
	stats["damage_dealt"] += dealt
	add_gauge(5.0 + a.get("poise", 20.0) * 0.05)
	var heavy: bool = a.get("kind", "") != "light" or res.get("critical", false)
	GameState.hitstop(0.085 if heavy else 0.05, 0.05)
	add_shake(0.55 if heavy else 0.3)
	viewmodel.flash(0.6)
	Sfx.play("hit_heavy" if heavy else "hit", hit_pos, 0.0)
	var col := Color(0.92, 0.94, 1.0) if mode != "devil" else Color(1.0, 0.25, 0.15)
	VFX.burst(arena, hit_pos, col, 22 if heavy else 14, 8.0, 0.14, 0.4)
	VFX.burst(arena, hit_pos, Color(0.02, 0.02, 0.025), 16, 5.0, 0.3, 0.5)
	var fwd := -transform.basis.z
	var x := Transform3D(Basis.looking_at(fwd, Vector3.UP).rotated(fwd, randf_range(-0.6, 0.6)), hit_pos)
	VFX.slash_arc(arena, x, 3.2 if heavy else 2.4, Color(0.02, 0.02, 0.03), col, 0.22)
	if arena.has_method("damage_number"):
		arena.damage_number(hit_pos, dealt, res.get("critical", false))


func _dash_strike_tick() -> void:
	if _attack.get("dash_hit", false) or arena == null:
		return
	var boss: Node = arena.get("boss")
	if boss == null or not is_instance_valid(boss) or not boss.call("is_alive"):
		return
	arena.nullify_projectiles_near(global_position + Vector3(0, 1, 0), 2.5)
	if global_position.distance_to(boss.global_position) <= float(boss.get("radius")) + 2.2:
		_attack["dash_hit"] = true
		var hit_pos: Vector3 = boss.call("aim_point")
		var res: Dictionary = boss.call("take_damage", _attack["dmg"] * _dmg_scale(), _attack.get("poise", 50.0), hit_pos)
		_on_hit_landed(res, hit_pos, {"kind": "ability", "poise": _attack.get("poise", 50.0)})


func _spawn_waves(a: Dictionary) -> void:
	var count: int = a.get("count", 1)
	var fwd := -camera.global_transform.basis.z
	for i in count:
		var spread := (i - (count - 1) * 0.5) * 0.16
		var dir := fwd.rotated(Vector3.UP, spread).normalized()
		var dmg: float = a["dmg"] * _dmg_scale()
		arena.spawn_player_wave(camera.global_position + fwd * 1.2 + Vector3(0, -0.25, 0), dir, a["speed"], dmg, a.get("poise", 25.0), a.get("radius", 1.5), mode)
	add_shake(0.35)


# ---------------------------------------------------------------- receiving damage

## info: {damage, source: Vector3, blockable: bool, magic: bool, kind: String, poise: float, knockback: float}
## Returns "dodged" | "parried" | "blocked" | "guard_break" | "hit" | "ignored".
func receive_hit(info: Dictionary) -> String:
	if state == "dead":
		return "ignored"
	if invuln > 0.0:
		if state == "dodge":
			add_gauge(4.0)
		return "dodged"
	var src: Vector3 = info.get("source", global_position)
	var to_src := src - global_position
	to_src.y = 0
	var facing := (-transform.basis.z).angle_to(to_src.normalized()) < deg_to_rad(65) if to_src.length() > 0.05 else true
	var dmg: float = info.get("damage", 50.0) * Settings.difficulty_data()["boss_dmg"]
	var magic: bool = info.get("magic", true)
	if blocking and info.get("blockable", true) and facing:
		if block_t <= PARRY_WINDOW:
			stats["parries"] += 1
			add_gauge(18.0)
			stamina = minf(stamina + 10.0, max_stamina)
			viewmodel.play("parry")
			viewmodel.flash(1.5)
			GameState.hitstop(0.12, 0.03)
			add_shake(0.5)
			Sfx.play("parry", null, 0.0)
			VFX.flash(arena, camera.global_position - camera.global_transform.basis.z, Color(1, 1, 1), 10.0, 6.0, 0.3)
			message.emit("PERFECT PARRY", Color(1.0, 0.95, 0.7))
			return "parried"
		var cost := dmg * (0.35 if magic else 0.6)
		stamina -= cost
		_stamina_delay = 0.6
		add_gauge(8.0 if magic else 2.0)
		Sfx.play("block", null, -2.0)
		viewmodel.flash(0.4)
		add_shake(0.25)
		if stamina < 0.0:
			stamina = 0.0
			blocking = false
			_apply_damage(dmg * 0.5, info)
			_set_state("stagger")
			viewmodel.play("flinch")
			message.emit("GUARD BROKEN", Color(1.0, 0.5, 0.4))
			return "guard_break"
		if not magic:
			_apply_damage(dmg * 0.12, info)
		return "blocked"
	_apply_damage(dmg, info)
	return "hit"


func _apply_damage(dmg: float, info: Dictionary) -> void:
	dmg *= float(mode_data()["damage_taken"])
	hp -= dmg
	stats["damage_taken"] += dmg
	took_damage.emit(dmg)
	add_shake(clampf(dmg / 120.0, 0.25, 1.0))
	Sfx.play("hurt", null, -2.0)
	var src: Vector3 = info.get("source", global_position)
	var away := (global_position - src)
	away.y = 0
	if away.length() > 0.01:
		push(away.normalized() * float(info.get("knockback", 6.0)))
	if hp <= 0.0 and test_god:
		hp = 1.0
	if hp <= 0.0:
		hp = 0.0
		_die()
		return
	if not mode_data()["hyper_armor"] and dmg >= 45.0 and state != "transform":
		_attack = {}
		_set_state("stagger")
		viewmodel.play("flinch")


func _die() -> void:
	_set_state("dead")
	lock_target = null
	blocking = false
	head.position.y = 0.4
	camera.rotation.z = 0.4
	died.emit()


# ---------------------------------------------------------------- lock-on

func _toggle_lock() -> void:
	if lock_target:
		lock_target = null
		return
	if arena == null:
		return
	var boss: Node3D = arena.get("boss")
	if boss and is_instance_valid(boss) and boss.call("is_alive"):
		lock_target = boss


func is_alive() -> bool:
	return state != "dead"
