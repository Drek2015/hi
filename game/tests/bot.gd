extends RefCounted
## Scripted Asta used by automated tests and `-- --autoplay`. Approaches, locks on, combos,
## blocks/dodges telegraphed attacks, transforms when the gauge allows, heals when low.

var _t := 0.0
var _next_attack := 0.0
var _next_def := 0.0
var _strafe := 1.0


func get_input(p: Player) -> Dictionary:
	var dt := 1.0 / Engine.physics_ticks_per_second
	_t += dt
	var pressed: Array = []
	var move := Vector2.ZERO
	var block := false
	var boss: Boss = p.arena.get("boss") if p.arena else null
	if boss == null or not is_instance_valid(boss) or not boss.is_alive():
		return {"move": move, "pressed": pressed, "block": false, "sprint": false}
	if p.lock_target == null:
		pressed.append("lock_on")
	var to := boss.global_position - p.global_position
	to.y = 0
	var d := to.length() - boss.radius
	if d > 2.4:
		move = Vector2(0, -1)
	else:
		if fmod(_t, 3.0) < dt:
			_strafe = -_strafe
		move = Vector2(_strafe * 0.6, 0.15)
	if d < 3.0 and _t >= _next_attack:
		pressed.append("attack_light")
		_next_attack = _t + 0.22
	if _t >= _next_def and boss.state == "attack":
		_next_def = _t + 0.6
		if randf() < 0.5:
			pressed.append("dodge")
		else:
			block = true
	if boss.state == "attack" and fmod(_t, 1.0) < 0.5:
		block = true
	if p.gauge >= 100.0 and p.mode != "devil":
		pressed.append("mode_devil")
	elif p.gauge >= 40.0 and p.mode == "base":
		pressed.append("mode_black")
	if p.gauge >= 30.0 and fmod(_t, 4.0) < dt:
		pressed.append("ability_1" if randf() < 0.5 else "ability_2")
	if p.hp < p.max_hp * 0.35 and p.heals > 0:
		pressed.append("heal")
	return {"move": move, "pressed": pressed, "block": block, "sprint": d > 10.0}
