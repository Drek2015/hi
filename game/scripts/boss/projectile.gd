class_name Projectile
extends Node3D
## Magic projectile (boss spells) or anti-magic slash wave (Asta). Collision is analytic
## (sphere vs capsule) so it is deterministic at any tick rate.

var arena: Node
var velocity := Vector3.ZERO
var damage := 60.0
var poise := 10.0
var radius := 0.4
var homing := 0.0          # max turn rate (rad/s)
var homing_time := 1.2     # seconds of homing before flying straight
var from_player := false
var element := "wind"
var life := 6.0
var knockback := 5.0
var reflected := false
var _age := 0.0
var _visual: Node3D
var _trail: GPUParticles3D


func setup(p_arena: Node, pos: Vector3, vel: Vector3, p_damage: float, p_radius: float, p_element: String, p_from_player := false) -> Projectile:
	arena = p_arena
	position = pos
	velocity = vel
	damage = p_damage
	radius = p_radius
	element = p_element
	from_player = p_from_player
	return self


func _ready() -> void:
	if from_player:
		_build_wave()
	else:
		_visual = VFX.orb(element, radius)
		add_child(_visual)
	var e := VFX.element(element)
	_trail = VFX.particles(e["rim"], 24 if not from_player else 40, 0.45, 0.6, radius * (0.9 if not from_player else 0.7), false, 30.0, 0.0, radius * 0.4)
	_trail.emitting = true
	add_child(_trail)


func _build_wave() -> void:
	# Anti-magic crescent: black body, white edge, flat and wide.
	_visual = Node3D.new()
	add_child(_visual)
	var col := Color(0.95, 0.96, 1.0) if element != "devil" else Color(1.0, 0.2, 0.12)
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(radius * 2.6, radius * 2.6)
	mi.mesh = q
	var m := ShaderMaterial.new()
	m.shader = VFX.shader("res://shaders/slash.gdshader")
	m.set_shader_parameter("core_color", Color(0.01, 0.01, 0.015))
	m.set_shader_parameter("edge_color", col)
	m.set_shader_parameter("intensity", 4.0)
	mi.material_override = m
	mi.rotation_degrees = Vector3(-90, 0, 90)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_visual.add_child(mi)
	element = "anti" if element != "devil" else "blood"


func _physics_process(delta: float) -> void:
	_age += delta
	life -= delta
	if life <= 0.0:
		expire(false)
		return
	if homing > 0.0 and _age < homing_time and arena and not from_player:
		var p: Node3D = arena.get("player")
		if p and is_instance_valid(p):
			var want: Vector3 = (p.global_position + Vector3(0, 1.0, 0) - global_position).normalized()
			var cur := velocity.normalized()
			var ang := cur.angle_to(want)
			if ang > 0.001:
				var axis := cur.cross(want).normalized()
				if axis.length() > 0.5:
					velocity = velocity.rotated(axis, minf(ang, homing * delta))
	global_position += velocity * delta
	if velocity.length() > 0.1:
		_visual.look_at(global_position + velocity, Vector3.UP if absf(velocity.normalized().y) < 0.95 else Vector3.RIGHT)
	if global_position.y < 0.05:
		expire(true)
		return
	_check_hits()


func _check_hits() -> void:
	if arena == null:
		return
	if from_player or reflected:
		var boss: Node3D = arena.get("boss")
		if boss and is_instance_valid(boss) and boss.call("is_alive"):
			if _hits_capsule(boss.global_position, float(boss.get("radius")) + radius, 2.0 * float(boss.get("height_scale"))):
				var res: Dictionary = boss.call("take_damage", damage, poise, global_position)
				var p: Node = arena.get("player")
				if p and res.get("damage", 0.0) > 0.0:
					p.call("_on_hit_landed", res, global_position, {"kind": "ability", "poise": poise})
				expire(true)
		return
	var player: Node3D = arena.get("player")
	if player == null or not is_instance_valid(player) or not player.call("is_alive"):
		return
	if _hits_capsule(player.global_position, Player.RADIUS + radius, 1.8):
		var res: String = player.call("receive_hit", {
			"damage": damage, "source": global_position - velocity.normalized() * 2.0, "blockable": true,
			"magic": true, "kind": "projectile", "knockback": knockback})
		match res:
			"dodged":
				return
			"parried":
				_reflect()
			_:
				expire(true)


func _hits_capsule(base: Vector3, r: float, height: float) -> bool:
	var y := clampf(global_position.y, base.y + 0.3, base.y + height)
	var closest := Vector3(base.x, y, base.z)
	return global_position.distance_to(closest) <= r


## Perfect parry sends the spell back at its caster with bonus damage.
func _reflect() -> void:
	reflected = true
	var boss: Node3D = arena.get("boss")
	var target := (boss.global_position + Vector3(0, 1.2, 0)) if boss and is_instance_valid(boss) else global_position - velocity
	velocity = (target - global_position).normalized() * velocity.length() * 1.4
	damage *= 1.5
	poise = 45.0
	life = 3.0
	VFX.burst(arena, global_position, Color(1, 1, 1), 20, 6.0, 0.15)


## Anti-magic cancel (sword touched it).
func nullify() -> void:
	VFX.burst(arena, global_position, Color(0.02, 0.02, 0.025), 18, 5.0, 0.25, 0.5)
	VFX.burst(arena, global_position, VFX.element(element)["rim"], 10, 4.0, 0.12, 0.4)
	_free()


func expire(impact: bool) -> void:
	if impact and arena:
		VFX.burst(arena, global_position, VFX.element(element)["rim"], 16, 5.0, radius * 0.5, 0.5)
		if radius > 0.5:
			VFX.flash(arena, global_position, VFX.element(element)["rim"], 3.0, 6.0, 0.2)
	_free()


func _free() -> void:
	if arena and arena.has_method("unregister_projectile"):
		arena.unregister_projectile(self)
	queue_free()
