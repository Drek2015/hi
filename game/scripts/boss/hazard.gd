class_name Hazard
extends Node3D
## Telegraphed area attacks: "circle" (delayed eruption), "ring" (expanding shockwave — jump it),
## "beam" (tracking channelled ray — block or strafe), "well" (gravity pull toward a point).

var arena: Node
var kind := "circle"
var element := "wind"
var damage := 80.0
var radius := 3.0
var delay := 1.0
var duration := 1.0
var speed := 12.0
var max_radius := 30.0
var width := 1.0
var track_rate := 0.6
var strength := 9.0
var origin_node: Node3D        # beam origin follows this (boss hand)
var dir := Vector3.FORWARD
var style := "pillar"          # circle visual: pillar | rain | spikes
var _t := 0.0
var _done := false
var _hit_once := false
var _tick := 0.0
var _mat: ShaderMaterial
var _mesh: MeshInstance3D
var _core: MeshInstance3D
var _falling: Node3D


func _ready() -> void:
	match kind:
		"circle": _build_circle()
		"ring": _build_ring()
		"beam": _build_beam()
		"well": _build_well()


func _telegraph_disc(r: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := PlaneMesh.new()
	q.size = Vector2(r * 2.0, r * 2.0)
	mi.mesh = q
	_mat = ShaderMaterial.new()
	_mat.shader = VFX.shader("res://shaders/telegraph.gdshader")
	_mat.set_shader_parameter("color", VFX.element(element)["rim"])
	mi.material_override = _mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position.y = 0.04
	add_child(mi)
	return mi


func _build_circle() -> void:
	_mesh = _telegraph_disc(radius)
	if style == "rain":
		_falling = VFX.orb(element, clampf(radius * 0.35, 0.4, 1.6))
		add_child(_falling)
		_falling.position.y = 24.0


func _build_ring() -> void:
	_mesh = MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.92
	t.outer_radius = 1.0
	t.rings = 48
	t.ring_segments = 8
	_mesh.mesh = t
	_mesh.material_override = VFX.energy_material(element, 3.0, 4.0)
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mesh.position.y = 0.45
	add_child(_mesh)


func _build_beam() -> void:
	_mesh = MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 1.0
	c.bottom_radius = 1.0
	c.height = 1.0
	c.radial_segments = 16
	_mesh.mesh = c
	_mesh.material_override = VFX.energy_material(element, 1.0, 6.0)
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_mesh)
	if float(VFX.element(element)["dark"]) > 0.5:
		_core = MeshInstance3D.new()
		_core.mesh = c
		_core.material_override = VFX.dark_core_material(VFX.element(element)["rim"])
		_core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_core)
	Sfx.play("cast", global_position, -3.0)


func _build_well() -> void:
	_mesh = _telegraph_disc(radius)
	var orb := VFX.orb(element, 1.0)
	orb.position.y = 1.2
	add_child(orb)


func _physics_process(delta: float) -> void:
	_t += delta
	match kind:
		"circle": _tick_circle()
		"ring": _tick_ring(delta)
		"beam": _tick_beam(delta)
		"well": _tick_well(delta)


func _player() -> Player:
	var p: Variant = arena.get("player") if arena else null
	return p if p is Player and is_instance_valid(p) and p.is_alive() else null


func _tick_circle() -> void:
	_mat.set_shader_parameter("progress", clampf(_t / delay, 0.0, 1.0))
	if _falling:
		_falling.position.y = lerpf(24.0, 0.5, pow(clampf(_t / delay, 0.0, 1.0), 2.0))
	if _t >= delay and not _done:
		_done = true
		var p := _player()
		if p:
			var d := Vector2(p.global_position.x - global_position.x, p.global_position.z - global_position.z).length()
			if d <= radius + Player.RADIUS and p.global_position.y - global_position.y < 3.0:
				p.receive_hit({"damage": damage, "source": global_position, "blockable": false, "magic": true, "kind": "aoe", "knockback": 9.0})
			if d < radius * 4.0:
				p.add_shake(clampf(1.0 - d / (radius * 4.0), 0.1, 0.7))
		_erupt()
	if _t >= delay + 0.9:
		queue_free()


func _erupt() -> void:
	var e := VFX.element(element)
	if _falling:
		_falling.queue_free()
		_falling = null
	_mesh.visible = false
	var col := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = radius * (0.25 if style == "spikes" else 0.8)
	c.bottom_radius = radius
	c.height = 7.0 if style != "spikes" else 3.0
	col.mesh = c
	col.material_override = VFX.energy_material(element, 2.5, 5.0) if style != "spikes" else VFX.energy_material(element, 1.5, 0.5)
	col.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	col.position.y = c.height * 0.5
	add_child(col)
	col.scale = Vector3(1, 0.1, 1)
	var tw := col.create_tween()
	tw.tween_property(col, "scale", Vector3(1, 1, 1), 0.12).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_EXPO)
	tw.tween_property(col, "scale", Vector3(0.05, 1.2, 0.05), 0.6).set_ease(Tween.EASE_IN)
	VFX.burst(arena, global_position + Vector3(0, 0.5, 0), e["rim"], 30, 9.0, 0.25, 0.7)
	VFX.flash(arena, global_position + Vector3(0, 1.5, 0), e["rim"], 5.0, radius * 4.0, 0.35)
	Sfx.play("explode", global_position, -4.0)


func _tick_ring(delta: float) -> void:
	var r := _t * speed
	_mesh.scale = Vector3(r, 1.2, r)
	if r > max_radius:
		queue_free()
		return
	var p := _player()
	if p and not _hit_once:
		var d := Vector2(p.global_position.x - global_position.x, p.global_position.z - global_position.z).length()
		var airborne := p.global_position.y - global_position.y > 0.75
		if absf(d - r) < 0.7 + speed * delta and not airborne:
			_hit_once = true
			p.receive_hit({"damage": damage, "source": global_position, "blockable": true, "magic": true, "kind": "ring", "knockback": 10.0})


func _tick_beam(delta: float) -> void:
	var src: Vector3 = origin_node.global_position if origin_node and is_instance_valid(origin_node) else global_position
	var p := _player()
	var charge := minf(delay, 0.9)
	if p:
		var want := (p.global_position + Vector3(0, 1.0, 0) - src).normalized()
		var rate := track_rate * (2.5 if _t < charge else 1.0)
		var ang := dir.angle_to(want)
		if ang > 0.001:
			var axis := dir.cross(want).normalized()
			if axis.length() > 0.5:
				dir = dir.rotated(axis, minf(ang, rate * delta)).normalized()
	var length := 60.0
	var w := width * (0.08 if _t < charge else 1.0)
	var xf := Transform3D(Basis.looking_at(dir, Vector3.UP if absf(dir.y) < 0.95 else Vector3.RIGHT), src + dir * length * 0.5)
	xf.basis = xf.basis * Basis(Vector3.RIGHT, deg_to_rad(90))
	xf.basis = xf.basis.scaled_local(Vector3(w, length, w))
	_mesh.global_transform = xf
	if _core:
		var cx := xf
		cx.basis = cx.basis.scaled_local(Vector3(0.55, 1.0, 0.55))
		_core.global_transform = cx
	if _t >= charge and p:
		_tick -= delta
		if _tick <= 0.0:
			var rel := p.global_position + Vector3(0, 0.9, 0) - src
			var along := clampf(rel.dot(dir), 0.0, length)
			var closest := src + dir * along
			if (p.global_position + Vector3(0, 0.9, 0)).distance_to(closest) < width + Player.RADIUS:
				_tick = 0.12
				p.receive_hit({"damage": damage * 0.06, "source": src, "blockable": true, "magic": true, "kind": "beam", "knockback": 2.0})
	if _t >= charge + duration:
		queue_free()


func _tick_well(delta: float) -> void:
	_mat.set_shader_parameter("progress", clampf(_t / duration, 0.0, 1.0))
	var p := _player()
	if p and _t < duration:
		var to := global_position - p.global_position
		to.y = 0
		var d := to.length()
		if d > 0.5 and d < max_radius:
			p.push(to.normalized() * strength * delta * 6.0)
	if _t >= duration and not _done:
		_done = true
		if p:
			var d := Vector2(p.global_position.x - global_position.x, p.global_position.z - global_position.z).length()
			if d <= radius + Player.RADIUS:
				p.receive_hit({"damage": damage, "source": global_position, "blockable": false, "magic": true, "kind": "aoe", "knockback": 12.0})
		_erupt()
	if _t >= duration + 0.9:
		queue_free()
