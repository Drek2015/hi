class_name ViewModel
extends Node3D
## First-person arms + swords. Procedurally modelled, animated from data/viewmodel_anims.json
## with eased keyframes, cross-fades, weapon sway, head-bob and a sword trail.

const ANIM_PATH := "res://data/viewmodel_anims.json"
const SKIN := Color(0.86, 0.66, 0.5)
const TRAIL_SAMPLES := 18

static var _anims: Dictionary = {}

var hand_r: Node3D
var hand_l: Node3D
var sway_root: Node3D
var mode := "base"

var _clip_name := ""
var _clip: Dictionary = {}
var _clip_t := 0.0
var _clip_speed := 1.0
var _hold := "idle"
var _blend_from: Array[Transform3D] = [Transform3D(), Transform3D()]
var _blend_t := 1.0
var _cur: Array[Transform3D] = [Transform3D(), Transform3D()]

var _bob_t := 0.0
var _sway := Vector2.ZERO
var _land := 0.0
var _mats: Dictionary = {}
var _arms: Dictionary = {}
var _aura_r: GPUParticles3D
var _aura_l: GPUParticles3D

var _trail_mesh: ImmediateMesh
var _trail_mi: MeshInstance3D
var _trail_mat: ShaderMaterial
var _trail_pts: Array = []  # [{a: Vector3, b: Vector3}]
var _tip_r: Node3D
var _base_r: Node3D
var _tip_l: Node3D
var _base_l: Node3D
var _right_blade: Node3D
var _right_blade_devil: Node3D


static func anims() -> Dictionary:
	if _anims.is_empty():
		var f := FileAccess.open(ANIM_PATH, FileAccess.READ)
		_anims = JSON.parse_string(f.get_as_text())
	return _anims


static func clip_info(name: String) -> Dictionary:
	return anims()["clips"].get(name, {})


func _ready() -> void:
	sway_root = Node3D.new()
	add_child(sway_root)
	hand_r = Node3D.new()
	hand_l = Node3D.new()
	sway_root.add_child(hand_r)
	sway_root.add_child(hand_l)
	_build_arm(hand_r, 1.0)
	_build_arm(hand_l, -1.0)
	_right_blade = _build_demon_slayer(hand_r)
	_right_blade_devil = _build_demon_slasher(hand_r)
	_build_demon_destroyer(hand_l)
	_base_r = _marker(hand_r, Vector3(0, 0.3, 0))
	_tip_r = _marker(hand_r, Vector3(0, 1.75, 0))
	_base_l = _marker(hand_l, Vector3(0, 0.3, 0))
	_tip_l = _marker(hand_l, Vector3(0, 1.95, 0))
	_build_trail()
	var idle: Dictionary = anims()["poses"]["idle"]
	_cur[0] = _pose_xf(idle["r"])
	_cur[1] = _pose_xf(idle["l"])
	set_mode("base")


# ---------------------------------------------------------------- modelling

func _vm_mat(albedo: Color, pattern: int, rough: float = 0.6, metal: float = 0.0) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = VFX.shader("res://shaders/viewmodel.gdshader")
	m.set_shader_parameter("albedo", albedo)
	m.set_shader_parameter("pattern", pattern)
	m.set_shader_parameter("roughness", rough)
	m.set_shader_parameter("metallic", metal)
	return m


func _mesh(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3, rot_deg: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = rot_deg
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


func _capsule(r: float, h: float) -> CapsuleMesh:
	var c := CapsuleMesh.new()
	c.radius = r
	c.height = h
	c.radial_segments = 20
	c.rings = 6
	return c


func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


func _marker(parent: Node3D, pos: Vector3) -> Node3D:
	var n := Node3D.new()
	n.position = pos
	parent.add_child(n)
	return n


func _build_arm(hand: Node3D, side: float) -> void:
	var key := "r" if side > 0 else "l"
	var skin := _vm_mat(SKIN, 2, 0.55)
	var sleeve := _vm_mat(Color(0.05, 0.05, 0.055), 5, 0.9)
	var wrap := _vm_mat(Color(0.12, 0.11, 0.1), 3, 0.9)
	_mats["skin_" + key] = skin
	# Fist around the grip, knuckles toward the blade's flat.
	_mesh(hand, _box(Vector3(0.085, 0.1, 0.095)), skin, Vector3(0, 0.0, 0.0))
	_mesh(hand, _box(Vector3(0.03, 0.06, 0.05)), skin, Vector3(-0.05 * side, 0.02, -0.03), Vector3(0, 0, 25 * side))
	# Forearm + upper arm are placed each frame by a two-bone solve (see _solve_arms).
	var fore := _mesh(sway_root, _capsule(0.052, 1.0), skin, Vector3.ZERO)
	var upper := _mesh(sway_root, _capsule(0.07, 1.0), sleeve, Vector3.ZERO)
	_mesh(hand, _capsule(0.058, 0.12), wrap, Vector3(0, -0.07, 0.02), Vector3(0, 0, 0))
	_arms[key] = {"hand": hand, "fore": fore, "upper": upper, "side": side}


func _build_demon_slayer(hand: Node3D) -> Node3D:
	var root := Node3D.new()
	hand.add_child(root)
	var blade := _vm_mat(Color(0.05, 0.05, 0.05), 1, 0.45, 0.85)
	blade.set_shader_parameter("blade_half_width", 0.15)
	_mats["blade_r"] = blade
	var metal := _vm_mat(Color(0.03, 0.03, 0.035), 0, 0.7, 0.3)
	var wrap := _vm_mat(Color(0.18, 0.12, 0.08), 3, 0.9)
	_mesh(root, _box(Vector3(0.3, 1.5, 0.04)), blade, Vector3(0, 1.0, 0))
	_mesh(root, _box(Vector3(0.05, 1.3, 0.05)), metal, Vector3(0, 0.95, 0))
	_mesh(root, _box(Vector3(0.36, 0.07, 0.09)), metal, Vector3(0, 0.22, 0))
	var grip := CylinderMesh.new()
	grip.top_radius = 0.03
	grip.bottom_radius = 0.032
	grip.height = 0.34
	_mesh(root, grip, wrap, Vector3(0, 0.02, 0))
	var pommel := SphereMesh.new()
	pommel.radius = 0.045
	pommel.height = 0.09
	_mesh(root, pommel, metal, Vector3(0, -0.17, 0))
	return root


func _build_demon_slasher(hand: Node3D) -> Node3D:
	# Devil-Union variant: same silhouette, wider, with a jagged spine.
	var root := Node3D.new()
	hand.add_child(root)
	var blade := _vm_mat(Color(0.04, 0.03, 0.03), 1, 0.4, 0.9)
	blade.set_shader_parameter("blade_half_width", 0.19)
	_mats["blade_devil"] = blade
	var metal := _vm_mat(Color(0.06, 0.05, 0.05), 0, 0.4, 0.9)
	_mesh(root, _box(Vector3(0.38, 1.6, 0.045)), blade, Vector3(0, 1.05, 0))
	for i in 5:
		_mesh(root, _box(Vector3(0.07, 0.12, 0.05)), metal, Vector3(-0.2, 0.5 + i * 0.28, 0), Vector3(0, 0, 35))
	_mesh(root, _box(Vector3(0.44, 0.08, 0.1)), metal, Vector3(0, 0.22, 0))
	var grip := CylinderMesh.new()
	grip.top_radius = 0.032
	grip.bottom_radius = 0.034
	grip.height = 0.34
	_mesh(root, grip, _vm_mat(Color(0.1, 0.03, 0.03), 3, 0.9), Vector3(0, 0.02, 0))
	root.visible = false
	return root


func _build_demon_destroyer(hand: Node3D) -> void:
	var blade := _vm_mat(Color(0.05, 0.05, 0.06), 1, 0.35, 0.95)
	blade.set_shader_parameter("blade_half_width", 0.075)
	_mats["blade_l"] = blade
	var metal := _vm_mat(Color(0.07, 0.07, 0.08), 0, 0.35, 0.9)
	_mesh(hand, _box(Vector3(0.15, 1.75, 0.03)), blade, Vector3(0, 1.1, 0))
	var tip := PrismMesh.new()
	tip.size = Vector3(0.15, 0.22, 0.03)
	_mesh(hand, tip, blade, Vector3(0, 2.08, 0))
	_mesh(hand, _box(Vector3(0.26, 0.05, 0.07)), metal, Vector3(0, 0.22, 0))
	var grip := CylinderMesh.new()
	grip.top_radius = 0.028
	grip.bottom_radius = 0.03
	grip.height = 0.3
	_mesh(hand, grip, _vm_mat(Color(0.15, 0.1, 0.08), 3, 0.9), Vector3(0, 0.03, 0))


func _build_trail() -> void:
	_trail_mesh = ImmediateMesh.new()
	_trail_mi = MeshInstance3D.new()
	_trail_mi.mesh = _trail_mesh
	_trail_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_trail_mat = ShaderMaterial.new()
	_trail_mat.shader = VFX.shader("res://shaders/trail.gdshader")
	_trail_mi.material_override = _trail_mat
	add_child(_trail_mi)


# ---------------------------------------------------------------- modes

func set_mode(m: String) -> void:
	mode = m
	var devil := m == "devil"
	var black := m == "black"
	hand_l.visible = devil
	_right_blade.visible = not devil
	_right_blade_devil.visible = devil
	var arm_col := Color(0.92, 0.93, 1.0) if black else Color(1.0, 0.12, 0.08)
	for key in ["skin_r", "skin_l"]:
		var mat: ShaderMaterial = _mats[key]
		if black or devil:
			mat.set_shader_parameter("pattern", 4)
			mat.set_shader_parameter("emission_color", arm_col)
			mat.set_shader_parameter("emission_energy", 1.2 if black else 2.2)
		else:
			mat.set_shader_parameter("pattern", 2)
			mat.set_shader_parameter("emission_energy", 0.0)
	var glow := Color(0.85, 0.9, 1.0) if black else (Color(1.0, 0.1, 0.05) if devil else Color(0.0, 0.0, 0.0))
	for key in ["blade_r", "blade_l", "blade_devil"]:
		var mat: ShaderMaterial = _mats[key]
		mat.set_shader_parameter("emission_color", glow)
		mat.set_shader_parameter("emission_energy", 0.0 if m == "base" else (0.8 if black else 1.6))
	_trail_mat.set_shader_parameter("edge_color", Color(0.92, 0.94, 1.0) if m != "devil" else Color(1.0, 0.18, 0.12))
	_trail_mat.set_shader_parameter("intensity", 1.5 if m == "base" else 3.0)
	for a in [_aura_r, _aura_l]:
		if a:
			a.queue_free()
	_aura_r = null
	_aura_l = null
	if m != "base":
		_aura_r = VFX.aura(Color(0.06, 0.06, 0.07, 1.0) if black else Color(0.5, 0.02, 0.02, 1.0), 48, 0.12, 0.16, 1.2)
		_tip_r.get_parent().add_child(_aura_r)
		_aura_r.position = Vector3(0, 1.0, 0)
		if devil:
			_aura_l = VFX.aura(Color(0.5, 0.02, 0.02, 1.0), 36, 0.1, 0.14, 1.2)
			hand_l.add_child(_aura_l)
			_aura_l.position = Vector3(0, 1.0, 0)


func flash(amount: float = 1.0) -> void:
	for key in ["blade_r", "blade_l", "blade_devil"]:
		var mat: ShaderMaterial = _mats[key]
		mat.set_shader_parameter("flash", amount)
		var tw := create_tween()
		tw.tween_method(func(v: float): mat.set_shader_parameter("flash", v), amount, 0.0, 0.25)


# ---------------------------------------------------------------- animation

func play(name: String, speed: float = 1.0) -> void:
	var c := clip_info(name)
	if c.is_empty():
		return
	_clip_name = name
	_clip = c
	_clip_t = 0.0
	_clip_speed = speed
	_blend_from = [_cur[0], _cur[1]]
	_blend_t = 0.0
	_trail_pts.clear()
	if c.has("sfx"):
		Sfx.play(c["sfx"], null, -4.0)


func set_hold(pose: String) -> void:
	if pose != _hold:
		_hold = pose
		if _clip_name == "":
			_blend_from = [_cur[0], _cur[1]]
			_blend_t = 0.0


func is_playing() -> bool:
	return _clip_name != ""


func current_clip() -> String:
	return _clip_name


func land(strength: float) -> void:
	_land = clampf(strength, 0.0, 1.0)


func _pose_xf(ch: Dictionary) -> Transform3D:
	var p: Array = ch["p"]
	var r: Array = ch["r"]
	var b := Basis.from_euler(Vector3(deg_to_rad(r[0]), deg_to_rad(r[1]), deg_to_rad(r[2])))
	return Transform3D(b, Vector3(p[0], p[1], p[2]))


func _channel(pose_name: String, ch: String) -> Transform3D:
	var poses: Dictionary = anims()["poses"]
	var pose: Dictionary = poses.get(pose_name, {})
	if pose.has(ch):
		return _pose_xf(pose[ch])
	var hold: Dictionary = poses.get(_hold, poses["idle"])
	return _pose_xf(hold[ch] if hold.has(ch) else poses["idle"][ch])


static func _ease(f: float, kind: String) -> float:
	match kind:
		"out": return 1.0 - (1.0 - f) * (1.0 - f)
		"in": return f * f
		"inout": return f * f * (3.0 - 2.0 * f)
		"expo_out": return 1.0 if f >= 1.0 else 1.0 - pow(2.0, -10.0 * f)
		"back_out":
			var c1 := 1.70158
			return 1.0 + (c1 + 1.0) * pow(f - 1.0, 3.0) + c1 * pow(f - 1.0, 2.0)
	return f


func _sample(ch: String) -> Transform3D:
	var keys: Array = _clip["keys"]
	var t := _clip_t
	for i in range(keys.size() - 1):
		var k0: Array = keys[i]
		var k1: Array = keys[i + 1]
		if t <= float(k1[1]):
			var span := maxf(float(k1[1]) - float(k0[1]), 0.0001)
			var f := clampf((t - float(k0[1])) / span, 0.0, 1.0)
			var e := _ease(f, k1[2] if k1.size() > 2 else "linear")
			var a := _channel(k0[0], ch)
			var b := _channel(k1[0], ch)
			return Transform3D(a.basis.slerp(b.basis, clampf(e, 0.0, 1.2)), a.origin.lerp(b.origin, e))
	return _channel(keys[-1][0], ch)


func update_motion(delta: float, look_delta: Vector2, ground_speed: float, on_floor: bool) -> void:
	_sway = _sway.lerp(look_delta * 0.0018, 1.0 - exp(-12.0 * delta))
	if on_floor and ground_speed > 0.5:
		_bob_t += delta * (5.5 + ground_speed * 0.7)
	else:
		_bob_t = lerpf(_bob_t, roundf(_bob_t / PI) * PI, 1.0 - exp(-6.0 * delta))
	_land = move_toward(_land, 0.0, delta * 3.5)
	var amp := clampf(ground_speed / 8.0, 0.0, 1.5)
	sway_root.position = Vector3(
		-_sway.x * 0.6 + sin(_bob_t) * 0.012 * amp,
		_sway.y * 0.6 - absf(cos(_bob_t)) * 0.018 * amp - _land * 0.06,
		0.0)
	sway_root.rotation = Vector3(_sway.y * 0.6, -_sway.x * 0.8, -_sway.x * 0.5)


func _process(delta: float) -> void:
	var target: Array[Transform3D] = [Transform3D(), Transform3D()]
	var trail_on := false
	if _clip_name != "":
		_clip_t += delta * _clip_speed
		if _clip_t >= float(_clip["length"]):
			_clip_name = ""
			_blend_from = [_cur[0], _cur[1]]
			_blend_t = 0.4
		else:
			target[0] = _sample("r")
			target[1] = _sample("l")
			var tr: Array = _clip.get("trail", [])
			trail_on = tr.size() == 2 and _clip_t >= float(tr[0]) and _clip_t <= float(tr[1])
	if _clip_name == "":
		var t := Time.get_ticks_msec() * 0.001
		var breathe := Transform3D(Basis(), Vector3(0, sin(t * 1.6) * 0.006, 0))
		target[0] = breathe * _channel(_hold, "r")
		target[1] = breathe * _channel(_hold, "l")
	_blend_t = minf(_blend_t + delta / 0.07, 1.0)
	for i in 2:
		var b := _blend_t * _blend_t * (3.0 - 2.0 * _blend_t)
		_cur[i] = Transform3D(_blend_from[i].basis.slerp(target[i].basis, b), _blend_from[i].origin.lerp(target[i].origin, b))
	hand_r.transform = _cur[0]
	hand_l.transform = _cur[1]
	_solve_arms()
	_update_trail(trail_on, delta)


## Cheap two-bone arm: wrist -> elbow (pushed out/down) -> shoulder just off-screen.
func _solve_arms() -> void:
	for key in _arms:
		var a: Dictionary = _arms[key]
		var hand: Node3D = a["hand"]
		var side: float = a["side"]
		var vis := hand.visible
		a["fore"].visible = vis
		a["upper"].visible = vis
		if not vis:
			continue
		var wrist: Vector3 = hand.transform * Vector3(0, -0.1, 0.03)
		var shoulder := Vector3(0.32 * side, -0.62, 0.32)
		var elbow := (wrist + shoulder) * 0.5 + Vector3(0.14 * side, -0.16, 0.02)
		_place_limb(a["fore"], wrist, elbow)
		_place_limb(a["upper"], elbow, shoulder)


func _place_limb(mi: MeshInstance3D, from: Vector3, to: Vector3) -> void:
	var d := to - from
	var len := maxf(d.length(), 0.01)
	var y := d / len
	var x := y.cross(Vector3.FORWARD)
	if x.length() < 0.01:
		x = y.cross(Vector3.RIGHT)
	x = x.normalized()
	var z := x.cross(y).normalized()
	mi.transform = Transform3D(Basis(x, y * (len + 0.06), z), (from + to) * 0.5)


func _update_trail(on: bool, _delta: float) -> void:
	var use_l: bool = _clip.get("trail_hand", "r") == "l"
	if on:
		var base := (_base_l if use_l else _base_r)
		var tip := (_tip_l if use_l else _tip_r)
		_trail_pts.push_front({"a": to_local(base.global_position), "b": to_local(tip.global_position)})
	elif not _trail_pts.is_empty():
		_trail_pts.pop_back()
	while _trail_pts.size() > TRAIL_SAMPLES:
		_trail_pts.pop_back()
	_trail_mesh.clear_surfaces()
	if _trail_pts.size() < 2:
		return
	_trail_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	var n := _trail_pts.size()
	for i in n:
		var u := float(i) / float(n - 1)
		_trail_mesh.surface_set_color(Color(1, 1, 1, 1))
		_trail_mesh.surface_set_uv(Vector2(u, 0.0))
		_trail_mesh.surface_add_vertex(_trail_pts[i]["a"])
		_trail_mesh.surface_set_uv(Vector2(u, 1.0))
		_trail_mesh.surface_add_vertex(_trail_pts[i]["b"])
	_trail_mesh.surface_end()
