class_name Boss
extends CharacterBody3D
## Data-driven soulslike boss. Behaviour is assembled from roster.json:
##  phases (HP thresholds, speed, aura, hover) -> weighted attack pools -> reusable attack patterns
##  (melee, volley, aoe, ring, beam, teleport, pull, summon, regen, combo).
## Readability rules: every attack has a wind-up pose + telegraph, tracks during wind-up and
## commits at the strike, and leaves a recovery window to punish.

signal hp_changed(hp: float, max_hp: float)
signal phase_changed(index: int, name: String)
signal announce(text: String)
signal died

const GRAVITY := 24.0

var def: Dictionary = {}
var arena: Node
var player: Player
var rig: CharacterRig

var max_hp := 3000.0
var hp := 3000.0
var max_poise := 300.0
var poise := 300.0
var radius := 0.55
var height_scale := 1.0
var element := "wind"
var phase_idx := 0
var state := "intro"
var state_t := 0.0
var speed_mult := 1.0
var dmg_mult := 1.0
var move_speed := 5.0
var preferred_range := 6.0
var hover_height := 0.0
var tracking := true
var attack_vel := Vector3.ZERO

var _think := 1.2
var _cooldowns: Dictionary = {}
var _token := 0
var _stagger_time := 2.4
var _poise_delay := 0.0
var _strafe := 1.0
var _strafe_t := 0.0
var _last_attack := ""
var _aura: GPUParticles3D
var _hover_override := -1.0
var _intro_time := 2.2
var _key_light: OmniLight3D  # element-tinted rim so the boss always reads against the arena


func setup(p_def: Dictionary, p_arena: Node) -> Boss:
	def = p_def
	arena = p_arena
	var diff: Dictionary = Settings.difficulty_data()
	var st: Dictionary = def["stats"]
	max_hp = float(st.get("hp", 3000)) * float(diff["boss_hp"])
	hp = max_hp
	max_poise = float(st.get("poise", 300))
	poise = max_poise
	dmg_mult = float(st.get("damage", 1.0))
	move_speed = float(st.get("speed", 5.0)) * float(diff["boss_speed"])
	preferred_range = float(st.get("preferred_range", 6.0))
	element = def.get("element", "wind")
	height_scale = float(def["appearance"].get("height", 1.0))
	radius = 0.5 * height_scale
	_apply_phase(0)
	return self


func _ready() -> void:
	rig = CharacterRig.new()
	add_child(rig)
	rig.build(def["appearance"])
	rig.set_pose("taunt", 6.0)
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = radius
	cap.height = 1.9 * height_scale
	shape.shape = cap
	shape.position.y = 0.95 * height_scale
	add_child(shape)
	_key_light = OmniLight3D.new()
	_key_light.omni_range = 7.0 * height_scale
	_key_light.light_energy = 1.4
	_key_light.shadow_enabled = false
	_key_light.position = Vector3(0, 1.6 * height_scale, -1.2 * height_scale)
	add_child(_key_light)
	_set_aura(phase()["aura"] if phase().has("aura") else def["appearance"].get("aura_color", "#ffffff"))


func is_alive() -> bool:
	return state != "dead"


func aim_point() -> Vector3:
	return global_position + Vector3(0, 1.25 * height_scale, 0)


func phase() -> Dictionary:
	return def["phases"][phase_idx]


func hp_ratio() -> float:
	return hp / max_hp


func _apply_phase(idx: int) -> void:
	phase_idx = idx
	var p := phase()
	speed_mult = float(p.get("speed", 1.0)) * float(Settings.difficulty_data()["boss_speed"])
	hover_height = float(p.get("hover", 0.0))
	if p.has("element"):
		element = p["element"]


func _set_aura(hex: String) -> void:
	if _aura:
		_aura.queue_free()
	var col := Color.from_string(hex, Color.WHITE)
	_aura = VFX.aura(col, int(40 * height_scale), 0.45 * height_scale, 0.16 * height_scale, 2.0)
	add_child(_aura)
	_aura.position.y = 1.0 * height_scale
	if rig:
		rig.set_eye_glow(col.lightened(0.3), 4.0)
	if _key_light:
		_key_light.light_color = col.lightened(0.4)


# ---------------------------------------------------------------- main loop

func _physics_process(delta: float) -> void:
	state_t += delta
	_poise_delay -= delta
	if _poise_delay <= 0.0 and state != "stagger":
		poise = minf(poise + max_poise * 0.25 * delta, max_poise)
	for k in _cooldowns.keys():
		_cooldowns[k] = float(_cooldowns[k]) - delta
	if player == null and arena:
		player = arena.get("player")

	var want_h := hover_height if _hover_override < 0.0 else _hover_override
	rig.hovering = want_h > 0.2
	if want_h > 0.0 or rig.hovering:
		velocity.y = (want_h - global_position.y) * 5.0
	elif not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = maxf(velocity.y, 0.0)

	var horiz := Vector3.ZERO
	match state:
		"intro":
			_face(delta, 4.0)
			if state_t >= _intro_time:
				state = "idle"
				rig.set_pose("combat", 6.0)
		"idle":
			horiz = _locomote(delta)
			_think -= delta
			if _think <= 0.0 and player and player.is_alive():
				_choose_attack()
		"attack":
			if tracking:
				_face(delta, 7.0 * speed_mult)
			horiz = attack_vel
		"stagger":
			if state_t >= _stagger_time:
				state = "idle"
				poise = max_poise
				_think = 0.35
				rig.set_pose("combat", 8.0)
		"transition", "dead":
			pass
	velocity.x = horiz.x
	velocity.z = horiz.z
	move_and_slide()
	var flat := Vector2(velocity.x, velocity.z).length()
	rig.locomotion = clampf(flat / 5.0, 0.0, 1.0) if state in ["idle", "attack"] else 0.0
	rig.locomotion_rate = clampf(flat / 4.0, 0.8, 1.8)


func _to_player() -> Vector3:
	if player == null:
		return Vector3.FORWARD
	var v := player.global_position - global_position
	v.y = 0
	return v


func _face(delta: float, rate: float) -> void:
	var v := _to_player()
	if v.length() < 0.05:
		return
	var want := atan2(-v.x, -v.z)
	rotation.y = lerp_angle(rotation.y, want, 1.0 - exp(-rate * delta))


func _forward() -> Vector3:
	return -global_transform.basis.z


func _locomote(delta: float) -> Vector3:
	_face(delta, 6.0)
	var v := _to_player()
	var d := v.length()
	var dir := v.normalized() if d > 0.01 else Vector3.ZERO
	_strafe_t -= delta
	if _strafe_t <= 0.0:
		_strafe_t = randf_range(1.2, 3.0)
		_strafe = -_strafe if randf() < 0.6 else _strafe
	var side := dir.cross(Vector3.UP) * _strafe
	var spd := move_speed * speed_mult
	if d > preferred_range + 1.5:
		rig.set_pose("idle", 6.0)
		return (dir * 1.0 + side * 0.15).normalized() * spd
	elif d < preferred_range - 2.0:
		rig.set_pose("combat", 6.0)
		return (-dir * 0.8 + side * 0.4).normalized() * spd * 0.6
	rig.set_pose("combat", 6.0)
	return side * spd * 0.45


# ---------------------------------------------------------------- attack selection

func _choose_attack() -> void:
	var d := _to_player().length()
	var options: Array = []
	var total := 0.0
	for aid in phase()["attacks"]:
		var a: Dictionary = def["attacks"][aid]
		if float(_cooldowns.get(aid, 0.0)) > 0.0:
			continue
		var rng: Array = a.get("range", [0, 99])
		if d < float(rng[0]) or d > float(rng[1]):
			continue
		var w := float(a.get("weight", 1.0)) * (0.25 if aid == _last_attack else 1.0)
		if a.get("type", "") == "regen" and hp_ratio() > 0.8:
			continue
		options.append([aid, w])
		total += w
	if options.is_empty():
		_think = 0.25
		return
	var r := randf() * total
	for o in options:
		r -= o[1]
		if r <= 0.0:
			run_attack(o[0])
			return
	run_attack(options[-1][0])


func run_attack(aid: String) -> void:
	var a: Dictionary = def["attacks"][aid]
	_token += 1
	var my := _token
	state = "attack"
	state_t = 0.0
	_last_attack = aid
	_cooldowns[aid] = float(a.get("cooldown", 3.0))
	await _exec(a, my)
	if my == _token and state == "attack":
		state = "idle"
		attack_vel = Vector3.ZERO
		tracking = true
		_hover_override = -1.0
		_think = float(a.get("recovery", 0.7)) / speed_mult
		rig.set_pose("combat", 8.0)
		rig.grimoire_glow(1.2)


func _exec(a: Dictionary, my: int) -> void:
	if a.has("name") and a.get("announce", true):
		announce.emit(a["name"])
	match a.get("type", ""):
		"melee": await _atk_melee(a, my)
		"volley": await _atk_volley(a, my)
		"aoe": await _atk_aoe(a, my)
		"ring": await _atk_ring(a, my)
		"beam": await _atk_beam(a, my)
		"teleport": await _atk_teleport(a, my)
		"pull": await _atk_pull(a, my)
		"summon": await _atk_summon(a, my)
		"regen": await _atk_regen(a, my)
		"combo":
			for step in a["params"]["sequence"]:
				if not _alive(my):
					return
				await _exec(def["attacks"][step], my)
	if a.has("follow") and _alive(my):
		await _exec(def["attacks"][a["follow"]], my)


func _alive(my: int) -> bool:
	return my == _token and state == "attack" and is_inside_tree() and player != null and player.is_alive()


func _wait(t: float) -> void:
	var tm := Timer.new()
	tm.one_shot = true
	tm.process_callback = Timer.TIMER_PROCESS_PHYSICS
	add_child(tm)
	tm.start(maxf(t / speed_mult, 0.016))
	await tm.timeout
	tm.queue_free()


func _p(a: Dictionary, key: String, fallback: Variant) -> Variant:
	return a.get("params", {}).get(key, fallback)


func _elem(a: Dictionary) -> String:
	return _p(a, "element", element)


func _windup(a: Dictionary, pose: String) -> void:
	rig.set_pose(pose, 9.0)
	rig.grimoire_glow(4.0)
	var hand := rig.hand_position("r")
	VFX.flash(arena, hand, VFX.element(_elem(a))["rim"], 3.0, 4.0, float(a.get("windup", 0.6)))
	VFX.burst(arena, hand, VFX.element(_elem(a))["rim"], 10, 2.0, 0.12, 0.5)


# ---------------------------------------------------------------- patterns

func _atk_melee(a: Dictionary, my: int) -> void:
	var hits: int = _p(a, "hits", 1)
	var poses: Array = _p(a, "poses", ["slash_r", "slash_l"])
	var windups: Array = _p(a, "windups", ["windup_r", "windup_l"])
	_hover_override = 0.0 if hover_height > 0.0 else -1.0
	tracking = true
	_windup(a, windups[0])
	Sfx.play("cast", global_position, -8.0)
	await _wait(float(a.get("windup", 0.6)))
	for i in hits:
		if not _alive(my):
			return
		tracking = false
		_face(1.0, 30.0)
		var dash: float = _p(a, "dash", 10.0)
		var d := _to_player().length()
		var dash_time: float = clampf((d - float(_p(a, "reach", 2.6)) * height_scale * 0.7) / maxf(dash, 0.1), 0.06, float(_p(a, "dash_time", 0.3)))
		attack_vel = _forward() * dash
		rig.set_pose(poses[i % poses.size()], 22.0)
		Sfx.play("swing_heavy", global_position, -2.0)
		await _wait(dash_time)
		attack_vel = Vector3.ZERO
		if not _alive(my):
			return
		_melee_hit(a)
		if i < hits - 1:
			tracking = true
			rig.set_pose(windups[(i + 1) % windups.size()], 14.0)
			await _wait(float(_p(a, "interval", 0.32)))
	await _wait(float(a.get("recovery_pose", 0.35)))


func _melee_hit(a: Dictionary) -> void:
	var reach: float = float(_p(a, "reach", 2.6)) * height_scale
	var arc: float = _p(a, "arc", 110.0)
	var e := VFX.element(_elem(a))
	var fwd := _forward()
	var origin := global_position + Vector3(0, 1.1 * height_scale, 0) + fwd * reach * 0.5
	var x := Transform3D(Basis.looking_at(fwd, Vector3.UP).rotated(fwd, randf_range(-0.5, 0.5)), origin)
	x.basis = x.basis * Basis(Vector3.RIGHT, deg_to_rad(-90))
	VFX.slash_arc(arena, x, reach * 2.2, e["core"].darkened(0.6), e["rim"], 0.28)
	var v := _to_player()
	var dist := v.length() - Player.RADIUS
	var ang := rad_to_deg(fwd.angle_to(v.normalized())) if v.length() > 0.01 else 0.0
	if dist <= reach and ang <= arc * 0.5 and absf(player.global_position.y - global_position.y) < 2.5 * height_scale:
		var res := player.receive_hit({
			"damage": float(_p(a, "dmg", 90.0)) * dmg_mult, "source": global_position, "blockable": true,
			"magic": _p(a, "magic", false), "kind": "melee", "knockback": float(_p(a, "knockback", 7.0))})
		if res == "parried":
			on_parried()


func _atk_volley(a: Dictionary, my: int) -> void:
	var from: String = _p(a, "from", "hand")
	_windup(a, "cast_charge_r" if from == "hand" else "cast_overhead")
	await _wait(float(a.get("windup", 0.7)))
	if not _alive(my):
		return
	rig.set_pose("cast_r" if from == "hand" else "cast_overhead", 16.0)
	var count: int = _p(a, "count", 5)
	var spread: float = deg_to_rad(float(_p(a, "spread", 30.0)))
	var spd: float = _p(a, "speed", 18.0)
	var delay: float = _p(a, "delay", 0.08)
	var pattern: String = _p(a, "pattern", "fan")
	for i in count:
		if not _alive(my):
			return
		var origin: Vector3
		match from:
			"above": origin = global_position + Vector3(randf_range(-2, 2), 3.5 * height_scale, randf_range(-1, 1))
			"around": origin = global_position + Vector3(cos(TAU * i / count), 0.0, sin(TAU * i / count)) * 2.0 + Vector3(0, 1.4 * height_scale, 0)
			_: origin = rig.hand_position("r")
		var target := player.global_position + Vector3(0, 1.0, 0)
		if _p(a, "lead", true):
			target += player.velocity * clampf(origin.distance_to(target) / spd, 0.0, 0.8) * 0.7
		var dir := (target - origin).normalized()
		match pattern:
			"fan":
				var f := 0.0 if count == 1 else (float(i) / (count - 1) - 0.5)
				dir = dir.rotated(Vector3.UP, f * spread)
			"ring":
				dir = Vector3(cos(TAU * i / count), 0.0, sin(TAU * i / count))
				origin = global_position + Vector3(0, 1.0, 0)
			"random":
				dir = dir.rotated(Vector3.UP, randf_range(-0.5, 0.5) * spread).rotated(dir.cross(Vector3.UP).normalized(), randf_range(-0.2, 0.2) * spread)
		var pr := arena.spawn_projectile(origin, dir * spd, float(_p(a, "dmg", 60.0)) * dmg_mult, float(_p(a, "radius", 0.35)), _elem(a)) as Projectile
		pr.homing = float(_p(a, "homing", 0.0))
		Sfx.play("cast", origin, -10.0, 0.2)
		if delay > 0.0:
			await _wait(delay)
	await _wait(0.25)


func _atk_aoe(a: Dictionary, my: int) -> void:
	_windup(a, "cast_overhead")
	await _wait(float(a.get("windup", 0.6)))
	if not _alive(my):
		return
	var count: int = _p(a, "count", 3)
	var target: String = _p(a, "target", "player")
	var r: float = _p(a, "radius", 2.5)
	var interval: float = _p(a, "interval", 0.15)
	var spread: float = _p(a, "spread", 3.0)
	var start := global_position
	var end := player.global_position
	for i in count:
		if not _alive(my):
			return
		var pos: Vector3
		match target:
			"line":
				pos = start.lerp(end + (end - start).normalized() * 4.0, float(i + 1) / count)
			"around_boss":
				var ang := TAU * i / count
				pos = global_position + Vector3(cos(ang), 0, sin(ang)) * spread
			_:
				pos = player.global_position + player.velocity * 0.35 + Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)) * (0.0 if i == 0 else spread)
		pos.y = 0.0
		arena.spawn_hazard("circle", pos, {
			"element": _elem(a), "damage": float(_p(a, "dmg", 90.0)) * dmg_mult, "radius": r,
			"delay": float(_p(a, "delay", 1.0)), "style": _p(a, "style", "pillar")})
		if interval > 0.0:
			await _wait(interval)
	await _wait(float(_p(a, "delay", 1.0)) * 0.5)


func _atk_ring(a: Dictionary, my: int) -> void:
	_windup(a, "slam_windup")
	var jump: bool = _p(a, "jump", true)
	if jump and hover_height <= 0.0:
		velocity.y = 9.0
	await _wait(float(a.get("windup", 0.7)))
	for i in int(_p(a, "count", 1)):
		if not _alive(my):
			return
		rig.set_pose("slam", 24.0)
		var pos := global_position
		pos.y = 0.0
		arena.spawn_hazard("ring", pos, {
			"element": _elem(a), "damage": float(_p(a, "dmg", 80.0)) * dmg_mult,
			"speed": float(_p(a, "speed", 13.0)), "max_radius": 32.0})
		VFX.burst(arena, pos + Vector3(0, 0.3, 0), VFX.element(_elem(a))["rim"], 40, 10.0, 0.3)
		Sfx.play("explode", pos, -1.0)
		if player.global_position.distance_to(pos) < 15.0:
			player.add_shake(0.6)
		await _wait(float(_p(a, "interval", 0.55)))
		rig.set_pose("slam_windup", 14.0)
	await _wait(0.2)


func _atk_beam(a: Dictionary, my: int) -> void:
	_windup(a, "cast_both")
	await _wait(float(a.get("windup", 0.4)))
	for i in int(_p(a, "count", 1)):
		if not _alive(my):
			return
		rig.set_pose("cast_both", 12.0)
		tracking = true
		var charge: float = _p(a, "charge", 0.8)
		var dur: float = _p(a, "duration", 1.6)
		var h: Hazard = arena.spawn_hazard("beam", rig.hand_position("r"), {
			"element": _elem(a), "damage": float(_p(a, "dmg", 300.0)) * dmg_mult, "width": float(_p(a, "width", 0.9)),
			"delay": charge, "duration": dur, "track_rate": float(_p(a, "track", 0.55)),
			"origin_node": rig.joints["hand_r"], "dir": (_forward() + Vector3(0, -0.1, 0)).normalized()})
		Sfx.play("beam", global_position, 0.0)
		await _wait((charge + dur) * speed_mult)  # beam timing is absolute
		if is_instance_valid(h) and not _alive(my):
			h.queue_free()
			return


func _atk_teleport(a: Dictionary, my: int) -> void:
	var e := VFX.element(_elem(a))
	VFX.burst(arena, global_position + Vector3(0, 1, 0), e["rim"], 30, 6.0, 0.25)
	Sfx.play("teleport", global_position, -2.0)
	rig.visible = false
	await _wait(float(a.get("windup", 0.25)))
	if not _alive(my):
		rig.visible = true
		return
	var side: String = _p(a, "side", "behind")
	var dist: float = _p(a, "dist", 3.5)
	var pf := -player.global_transform.basis.z
	pf.y = 0
	pf = pf.normalized()
	var off := -pf * dist
	match side:
		"flank": off = pf.cross(Vector3.UP) * dist * (1.0 if randf() < 0.5 else -1.0)
		"far": off = -pf * -dist * 3.0
		"random": off = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized() * dist
	var target := player.global_position + off
	var lim: float = arena.get("arena_radius") * 0.9
	if Vector2(target.x, target.z).length() > lim:
		target = player.global_position - off
	target.y = global_position.y
	global_position = target
	_face(1.0, 60.0)
	rig.visible = true
	VFX.burst(arena, global_position + Vector3(0, 1, 0), e["rim"], 30, 6.0, 0.25)
	Sfx.play("teleport", global_position, -2.0)
	await _wait(0.08)


func _atk_pull(a: Dictionary, my: int) -> void:
	_windup(a, "cast_both")
	await _wait(float(a.get("windup", 0.5)))
	if not _alive(my):
		return
	var pos := global_position
	pos.y = 0
	var dur: float = _p(a, "duration", 2.0)
	arena.spawn_hazard("well", pos, {
		"element": _elem(a), "damage": float(_p(a, "dmg", 160.0)) * dmg_mult, "radius": float(_p(a, "radius", 5.0)),
		"duration": dur, "strength": float(_p(a, "strength", 9.0)), "max_radius": 40.0})
	rig.set_pose("cast_overhead", 8.0)
	Sfx.play("beam", pos, -4.0)
	await _wait(dur * speed_mult + 0.3)


func _atk_summon(a: Dictionary, my: int) -> void:
	_windup(a, "cast_overhead")
	await _wait(float(a.get("windup", 0.6)))
	if not _alive(my):
		return
	var count: int = _p(a, "count", 6)
	var orbs: Array = []
	for i in count:
		var ang := TAU * i / count
		var pos := global_position + Vector3(cos(ang) * 2.5, 2.6 * height_scale + sin(ang * 2.0) * 0.4, sin(ang) * 2.5)
		var pr: Projectile = arena.spawn_projectile(pos, Vector3.ZERO, float(_p(a, "dmg", 55.0)) * dmg_mult, float(_p(a, "radius", 0.4)), _elem(a))
		pr.life = 12.0
		orbs.append(pr)
		await _wait(0.06)
	rig.set_pose("taunt", 8.0)
	await _wait(float(_p(a, "delay", 0.8)))
	for pr in orbs:
		if not _alive(my):
			return
		if is_instance_valid(pr):
			var dir: Vector3 = (player.global_position + Vector3(0, 1.0, 0) - pr.global_position).normalized()
			pr.velocity = dir * float(_p(a, "speed", 16.0))
			pr.homing = float(_p(a, "homing", 1.2))
			pr.homing_time = pr._age + 1.0
			pr.life = 5.0
		await _wait(float(_p(a, "interval", 0.18)))


func _atk_regen(a: Dictionary, my: int) -> void:
	rig.set_pose("guard", 8.0)
	var total: float = float(_p(a, "amount", 0.08)) * max_hp
	var dur: float = _p(a, "duration", 2.0)
	var steps := 10
	for i in steps:
		if not _alive(my):
			return
		hp = minf(hp + total / steps, max_hp)
		hp_changed.emit(hp, max_hp)
		VFX.burst(arena, aim_point(), VFX.element(_elem(a))["rim"], 8, 2.0, 0.15, 0.6)
		await _wait(dur / steps)


# ---------------------------------------------------------------- receiving damage

func take_damage(amount: float, poise_dmg: float, _hit_pos: Vector3) -> Dictionary:
	if state == "dead" or state == "transition":
		return {"damage": 0.0, "critical": false}
	var crit := state == "stagger"
	var dmg := amount * (1.6 if crit else 1.0)
	hp -= dmg
	rig.flash_hit(1.0 if crit else 0.7)
	hp_changed.emit(maxf(hp, 0.0), max_hp)
	poise -= poise_dmg
	_poise_delay = 3.0
	if hp <= 0.0:
		hp = 0.0
		_die()
		return {"damage": dmg, "critical": crit}
	var nxt := phase_idx + 1
	if nxt < def["phases"].size() and hp_ratio() <= float(def["phases"][nxt]["threshold"]):
		_begin_transition(nxt)
	elif poise <= 0.0 and state != "stagger":
		_stagger(2.4)
	return {"damage": dmg, "critical": crit}


func on_parried() -> void:
	poise -= max_poise * 0.4
	_poise_delay = 3.0
	if poise <= 0.0:
		_stagger(2.6)
	else:
		_stagger(0.9, "recoil")


func _stagger(t: float, pose: String = "kneel") -> void:
	_token += 1
	state = "stagger"
	state_t = 0.0
	_stagger_time = t
	attack_vel = Vector3.ZERO
	tracking = true
	rig.visible = true
	_hover_override = 0.0 if t > 1.5 else -1.0
	rig.set_pose(pose, 12.0)
	if t > 1.5:
		announce.emit("STAGGERED")
		VFX.burst(arena, aim_point(), Color(1, 0.9, 0.6), 30, 6.0, 0.2)
		Sfx.play("parry", aim_point(), -4.0)


func _begin_transition(idx: int) -> void:
	_token += 1
	var my := _token
	state = "transition"
	state_t = 0.0
	attack_vel = Vector3.ZERO
	rig.visible = true
	_apply_phase(idx)
	var p := phase()
	rig.set_pose("cast_overhead", 6.0)
	phase_changed.emit(idx, p.get("name", "Phase %d" % (idx + 1)))
	if p.has("aura"):
		_set_aura(p["aura"])
	VFX.shockwave(arena, aim_point(), element, 10.0, 0.9)
	VFX.flash(arena, aim_point(), VFX.element(element)["rim"], 12.0, 25.0, 1.2)
	Sfx.play("transform", global_position, 2.0)
	if player:
		player.add_shake(0.9)
		var away := player.global_position - global_position
		away.y = 0
		if away.length() < 8.0:
			player.push(away.normalized() * 14.0)
	await _wait_abs(2.6)
	if my == _token and state == "transition":
		state = "idle"
		poise = max_poise
		_think = 0.4
		_cooldowns.clear()


func _wait_abs(t: float) -> void:
	await _wait(t * speed_mult)


func _die() -> void:
	_token += 1
	state = "dead"
	rig.visible = true
	attack_vel = Vector3.ZERO
	_hover_override = 0.0
	rig.set_pose("death", 3.0)
	if _aura:
		_aura.emitting = false
	if _key_light:
		_key_light.create_tween().tween_property(_key_light, "light_energy", 0.0, 2.0)
	collision_layer = 0
	VFX.shockwave(arena, aim_point(), element, 6.0, 1.2)
	VFX.burst(arena, aim_point(), VFX.element(element)["rim"], 80, 8.0, 0.25, 1.4)
	died.emit()
