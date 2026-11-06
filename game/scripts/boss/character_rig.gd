class_name CharacterRig
extends Node3D
## Procedural stylised (anime cel-shaded) humanoid built from an appearance spec in roster.json,
## with a pose-blending animator driven by data/rig_poses.json plus procedural walk/hover cycles.
## The character-artist agent extends this file (new hair styles, outfits, accessories).

const POSE_PATH := "res://data/rig_poses.json"
const JOINTS := ["hips", "spine", "chest", "neck", "head",
	"upper_arm_l", "forearm_l", "hand_l", "upper_arm_r", "forearm_r", "hand_r",
	"thigh_l", "shin_l", "foot_l", "thigh_r", "shin_r", "foot_r"]

static var _poses: Dictionary = {}

var s := 1.0
var joints: Dictionary = {}
var locomotion := 0.0       # 0..1 walk cycle weight
var locomotion_rate := 1.0
var hovering := false
var _cur: Dictionary = {}
var _target_pose := "idle"
var _blend := 10.0
var _phase := 0.0
var _hip_base := 0.0
var _root_y := 0.0
var _mats: Array[StandardMaterial3D] = []
var _flash := 0.0
var _cape: Node3D
var _grimoire: Node3D
var _grimoire_mat: StandardMaterial3D
var _wings: Node3D
var _eye_mat: StandardMaterial3D
var appearance: Dictionary = {}
var _skinned: SkinnedBody


static func poses() -> Dictionary:
	if _poses.is_empty():
		var f := FileAccess.open(POSE_PATH, FileAccess.READ)
		_poses = JSON.parse_string(f.get_as_text())["poses"]
	return _poses


func build(app: Dictionary) -> void:
	appearance = app
	s = float(app.get("height", 1.0))
	if SkinnedBody.available(app):
		_skinned = SkinnedBody.new()
		add_child(_skinned)
		if _skinned.build(app, s):
			joints = _skinned.joints
			_build_extras(app)
			return
		_skinned.queue_free()
		_skinned = null
		joints = {}
	var skin := _toon(_c(app, "skin", "#e8c4a8"))
	var top := _toon(_c(app, "outfit_primary", "#222222"))
	var bottom := _toon(_c(app, "outfit_secondary", "#333333"))
	var accent := _toon(_c(app, "accent", "#c9a24a"), 0.4)
	var hair := _toon(_c(app, "hair_color", "#111111"))
	var boots := _toon(_c(app, "boots", "#1a1512"))
	var sleeves: bool = app.get("sleeves", true)

	var hips := _joint("hips", self, Vector3(0, 0.98, 0))
	_hip_base = 0.98 * s
	_part(hips, _box(Vector3(0.34, 0.2, 0.22)), bottom, Vector3(0, -0.02, 0))
	_part(hips, _box(Vector3(0.36, 0.05, 0.24)), accent, Vector3(0, 0.08, 0))  # belt
	var spine := _joint("spine", hips, Vector3(0, 0.1, 0))
	_part(spine, _capsule(0.15, 0.36), top, Vector3(0, 0.1, 0), Vector3.ZERO, Vector3(1.1, 1, 0.8))
	var chest := _joint("chest", spine, Vector3(0, 0.22, 0))
	_part(chest, _capsule(0.19, 0.46), top, Vector3(0, 0.12, 0), Vector3.ZERO, Vector3(1.2, 1, 0.78))
	_part(chest, _box(Vector3(0.46, 0.05, 0.27)), accent, Vector3(0, 0.3, 0))     # collar trim
	var neck := _joint("neck", chest, Vector3(0, 0.32, 0))
	_part(neck, _capsule(0.05, 0.14), skin, Vector3(0, 0.03, 0))
	var head := _joint("head", neck, Vector3(0, 0.1, 0))
	_part(head, _sphere(0.13), skin, Vector3(0, 0.1, 0), Vector3.ZERO, Vector3(0.9, 1.08, 1.0))
	_eye_mat = _glow(_c(app, "eye_color", "#ffd060"), 3.0)
	for side in [-1.0, 1.0]:
		_part(head, _sphere(0.018), _eye_mat, Vector3(0.045 * side, 0.11, -0.115))
	_build_hair(head, hair, app.get("hair_style", "short_messy"))
	if app.get("horns", false):
		var hm := _toon(_c(app, "horn_color", "#1a1a1a"), 0.2)
		for side in [-1.0, 1.0]:
			var cone := CylinderMesh.new()
			cone.top_radius = 0.0
			cone.bottom_radius = 0.035
			cone.height = 0.24
			_part(head, cone, hm, Vector3(0.08 * side, 0.26, 0.0), Vector3(-20, 0, -28 * side))

	for side_name in ["l", "r"]:
		var side := -1.0 if side_name == "l" else 1.0
		var ua := _joint("upper_arm_" + side_name, chest, Vector3(0.23 * side, 0.25, 0))
		_part(ua, _sphere(0.075), top, Vector3.ZERO)  # shoulder
		_part(ua, _capsule(0.058, 0.34), top if sleeves else skin, Vector3(0, -0.15, 0))
		var fa := _joint("forearm_" + side_name, ua, Vector3(0, -0.3, 0))
		_part(fa, _capsule(0.05, 0.31), top if sleeves else skin, Vector3(0, -0.14, 0))
		_part(fa, _capsule(0.056, 0.08), accent, Vector3(0, -0.24, 0))  # cuff
		var hand := _joint("hand_" + side_name, fa, Vector3(0, -0.29, 0))
		_part(hand, _box(Vector3(0.07, 0.1, 0.05)), skin, Vector3(0, -0.04, 0))
		var th := _joint("thigh_" + side_name, hips, Vector3(0.1 * side, -0.07, 0))
		_part(th, _capsule(0.078, 0.5), bottom, Vector3(0, -0.22, 0))
		var sh := _joint("shin_" + side_name, th, Vector3(0, -0.45, 0))
		_part(sh, _capsule(0.064, 0.47), boots, Vector3(0, -0.21, 0))
		var ft := _joint("foot_" + side_name, sh, Vector3(0, -0.43, 0))
		_part(ft, _box(Vector3(0.1, 0.08, 0.25)), boots, Vector3(0, -0.02, -0.06))

	var outfit: String = app.get("outfit", "robe")
	if outfit in ["robe", "dress"]:
		var skirt := CylinderMesh.new()
		skirt.top_radius = 0.2
		skirt.bottom_radius = 0.42 if outfit == "robe" else 0.38
		skirt.height = 0.62 if outfit == "robe" else 0.5
		skirt.radial_segments = 20
		_part(hips, skirt, top if outfit == "robe" else _toon(_c(app, "dress_color", "#e6e8f0")), Vector3(0, -0.3, 0))
	elif outfit == "coat":
		# Open long coat: back panel + two side tails, legs visible from the front.
		_part(hips, _box(Vector3(0.38, 0.7, 0.03)), top, Vector3(0, -0.36, 0.13), Vector3(-8, 0, 0))
		for side in [-1.0, 1.0]:
			_part(hips, _box(Vector3(0.03, 0.66, 0.24)), top, Vector3(0.19 * side, -0.34, 0.02), Vector3(0, 0, 6 * side))
			_part(hips, _box(Vector3(0.1, 0.64, 0.025)), top, Vector3(0.14 * side, -0.33, -0.12), Vector3(6, 0, 4 * side))
	if app.get("cape", true):
		_cape = _joint("cape", chest, Vector3(0, 0.3, 0.15))
		_part(_cape, _box(Vector3(0.52, 1.15, 0.025)), _toon(_c(app, "cape_color", "#151515")), Vector3(0, -0.55, 0.0))
		_part(_cape, _box(Vector3(0.54, 0.04, 0.03)), accent, Vector3(0, -1.11, 0))
	match app.get("weapon", "none"):
		"katana":
			_weapon(joints["hand_r"], Vector3(0.025, 1.05, 0.012), _toon(Color(0.75, 0.77, 0.8), 0.6, 0.9), _toon(Color(0.08, 0.08, 0.1)))
		"bone_blade":
			_weapon(joints["hand_r"], Vector3(0.07, 1.0, 0.03), _toon(Color(0.93, 0.9, 0.82)), _toon(Color(0.4, 0.35, 0.3)))
		"spear":
			_weapon(joints["hand_r"], Vector3(0.03, 2.0, 0.03), _glow(_c(app, "aura_color", "#66ccff"), 1.5), _toon(Color(0.8, 0.8, 0.85)))
		"sword":
			_weapon(joints["hand_r"], Vector3(0.06, 1.0, 0.015), _toon(Color(0.8, 0.82, 0.88), 0.6, 0.9), _toon(Color(0.7, 0.55, 0.2)))
	if app.get("grimoire", true):
		_grimoire = Node3D.new()
		add_child(_grimoire)
		_grimoire.position = Vector3(-0.5, 1.3, -0.12) * s
		_grimoire_mat = _glow(_c(app, "grimoire_glow", "#ffd27a"), 1.2)
		_part(_grimoire, _box(Vector3(0.2, 0.27, 0.06)), _toon(_c(app, "grimoire_color", "#5a3a1a")), Vector3.ZERO)
		_part(_grimoire, _box(Vector3(0.08, 0.08, 0.065)), _grimoire_mat, Vector3(0, 0.02, 0))
	var wings: String = app.get("wings", "none")
	if wings != "none":
		_build_wings(chest, wings, app)
	for j in JOINTS:
		_cur[j] = Vector3.ZERO


## Cape, horns, weapon, grimoire and wings on a skinned body (attachment holders are in rig units).
func _build_extras(app: Dictionary) -> void:
	var accent := _toon(_c(app, "accent", "#c9a24a"), 0.4)
	_eye_mat = _glow(_c(app, "eye_color", "#ffd060"), 3.0)
	if app.get("cape_on_model", false) and joints.has("chest"):
		_cape = Node3D.new()
		joints["chest"].add_child(_cape)
		_cape.position = Vector3(0, 0.14, 0.13) * s
		_part(_cape, _box(Vector3(0.5, 1.1, 0.025)), _toon(_c(app, "cape_color", "#151515")), Vector3(0, -0.55, 0))
		_part(_cape, _box(Vector3(0.52, 0.04, 0.03)), accent, Vector3(0, -1.08, 0))
	if app.get("horns", false) and joints.has("head"):
		var hm := _toon(_c(app, "horn_color", "#1a1a1a"), 0.2)
		for side in [-1.0, 1.0]:
			_part(joints["head"], _cone(0.035, 0.24), hm, Vector3(0.08 * side, 0.2, 0.0), Vector3(-20, 0, -28 * side))
	if joints.has("hand_r"):
		match app.get("weapon", "none"):
			"katana": _weapon(joints["hand_r"], Vector3(0.025, 1.05, 0.012), _toon(Color(0.75, 0.77, 0.8), 0.6, 0.9), _toon(Color(0.08, 0.08, 0.1)))
			"bone_blade": _weapon(joints["hand_r"], Vector3(0.07, 1.0, 0.03), _toon(Color(0.93, 0.9, 0.82)), _toon(Color(0.4, 0.35, 0.3)))
			"spear": _weapon(joints["hand_r"], Vector3(0.03, 2.0, 0.03), _glow(_c(app, "aura_color", "#66ccff"), 1.5), _toon(Color(0.8, 0.8, 0.85)))
			"sword": _weapon(joints["hand_r"], Vector3(0.06, 1.0, 0.015), _toon(Color(0.8, 0.82, 0.88), 0.6, 0.9), _toon(Color(0.7, 0.55, 0.2)))
	if app.get("grimoire", true):
		_build_book(app)
	if app.get("wings", "none") != "none" and joints.has("chest"):
		_build_wings(joints["chest"], app.get("wings"), app)
		_wings.position = Vector3(0, 0.05, 0.14) * s


## Floating grimoire: half-open book with cover, page block and a glowing clover emblem.
func _build_book(app: Dictionary) -> void:
	_grimoire = Node3D.new()
	add_child(_grimoire)
	_grimoire.position = Vector3(-0.55, 1.3, -0.12) * s
	_grimoire_mat = _glow(_c(app, "grimoire_glow", "#ffd27a"), 1.2)
	var cover := _toon(_c(app, "grimoire_color", "#5a3a1a"), 0.5)
	var pages := _toon(Color(0.93, 0.88, 0.76), 0.2)
	var book := Node3D.new()
	book.scale = Vector3.ONE * 0.8
	book.rotation_degrees = Vector3(-15, 25, 0)
	_grimoire.add_child(book)
	for side in [-1.0, 1.0]:
		var half := Node3D.new()
		half.rotation_degrees = Vector3(0, 18 * side, 0)
		book.add_child(half)
		_part(half, _box(Vector3(0.16, 0.24, 0.012)), cover, Vector3(0.08 * side, 0, 0))
		_part(half, _box(Vector3(0.145, 0.22, 0.02)), pages, Vector3(0.078 * side, 0, -0.014))
	_part(book, _box(Vector3(0.02, 0.24, 0.03)), cover, Vector3(0, 0, 0.004))
	for i in 4:
		var leaf := SphereMesh.new()
		leaf.radius = 0.018
		leaf.height = 0.036
		var a := TAU * i / 4.0 + PI / 4.0
		_part(book, leaf, _grimoire_mat, Vector3(0.07 + cos(a) * 0.02, sin(a) * 0.02, 0.012))


func _c(app: Dictionary, key: String, fallback: String) -> Color:
	return Color.from_string(str(app.get(key, fallback)), Color(fallback))


func _toon(col: Color, rim: float = 0.55, metal: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	m.specular_mode = BaseMaterial3D.SPECULAR_TOON
	m.roughness = 0.65
	m.metallic = metal
	m.rim_enabled = true
	m.rim = rim
	m.rim_tint = 0.6
	m.emission_enabled = true
	m.emission = Color.WHITE
	m.emission_energy_multiplier = 0.0
	var outline := StandardMaterial3D.new()
	outline.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	outline.albedo_color = Color(0.02, 0.015, 0.02)
	outline.cull_mode = BaseMaterial3D.CULL_FRONT
	outline.grow = true
	outline.grow_amount = 0.011 * s
	m.next_pass = outline
	_mats.append(m)
	return m


func _glow(col: Color, energy: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = col
	m.emission_enabled = true
	m.emission = col
	m.emission_energy_multiplier = energy
	return m


func _joint(name: String, parent: Node3D, pos: Vector3) -> Node3D:
	var j := Node3D.new()
	j.name = name
	j.position = pos * s
	parent.add_child(j)
	joints[name] = j
	return j


func _part(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3, rot_deg: Vector3 = Vector3.ZERO, scl: Vector3 = Vector3.ONE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos * s
	mi.rotation_degrees = rot_deg
	mi.scale = scl * s
	parent.add_child(mi)
	return mi


func _capsule(r: float, h: float) -> CapsuleMesh:
	var c := CapsuleMesh.new()
	c.radius = r
	c.height = maxf(h, r * 2.0)
	c.radial_segments = 16
	c.rings = 6
	return c


func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


func _sphere(r: float) -> SphereMesh:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0
	m.radial_segments = 20
	m.rings = 10
	return m


func _cone(r: float, h: float) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = 0.0
	c.bottom_radius = r
	c.height = h
	c.radial_segments = 8
	return c


func _weapon(hand: Node3D, blade: Vector3, blade_mat: Material, hilt_mat: Material) -> void:
	var w := Node3D.new()
	hand.add_child(w)
	w.position = Vector3(0, -0.05, 0) * s
	w.rotation_degrees = Vector3(-90, 0, 0)  # blade points along hand -Z (forward from the fist)
	_part(w, _box(Vector3(0.035, 0.22, 0.035)), hilt_mat, Vector3(0, -0.02, 0))
	_part(w, _box(Vector3(0.14, 0.02, 0.05)), hilt_mat, Vector3(0, 0.1, 0))
	_part(w, _box(blade), blade_mat, Vector3(0, 0.1 + blade.y * 0.5, 0))


func _build_hair(head: Node3D, mat: Material, style: String) -> void:
	_part(head, _sphere(0.142), mat, Vector3(0, 0.13, 0.012), Vector3.ZERO, Vector3(0.96, 0.92, 1.02))
	match style:
		"short_messy":
			for i in 9:
				var a := TAU * i / 9.0
				_part(head, _cone(0.05, 0.16), mat, Vector3(sin(a) * 0.1, 0.2, cos(a) * 0.1 + 0.02), Vector3(110 * cos(a) * 0.5 + 40, 0, -sin(a) * 60))
			_part(head, _cone(0.04, 0.12), mat, Vector3(0.03, 0.17, -0.12), Vector3(-130, 0, 10))
			_part(head, _cone(0.04, 0.12), mat, Vector3(-0.04, 0.17, -0.12), Vector3(-125, 0, -15))
		"spiky":
			for i in 8:
				var a := TAU * i / 8.0
				_part(head, _cone(0.045, 0.26), mat, Vector3(sin(a) * 0.08, 0.24, cos(a) * 0.08 + 0.03), Vector3(cos(a) * 45, 0, -sin(a) * 45))
		"slick":
			_part(head, _capsule(0.12, 0.3), mat, Vector3(0, 0.17, 0.06), Vector3(80, 0, 0))
		"long_straight":
			_part(head, _box(Vector3(0.26, 0.55, 0.06)), mat, Vector3(0, -0.08, 0.1))
			for side in [-1.0, 1.0]:
				_part(head, _box(Vector3(0.05, 0.4, 0.08)), mat, Vector3(0.12 * side, -0.02, -0.02))
		"twintail":
			for side in [-1.0, 1.0]:
				_part(head, _capsule(0.06, 0.6), mat, Vector3(0.17 * side, -0.05, 0.05), Vector3(10, 0, 18 * side))
			_part(head, _box(Vector3(0.26, 0.08, 0.05)), mat, Vector3(0, 0.2, -0.1), Vector3(-30, 0, 0))
		"bandana":
			_part(head, _box(Vector3(0.3, 0.05, 0.3)), _toon(_c(appearance, "accent", "#cccccc")), Vector3(0, 0.17, 0.0))
			for i in 7:
				var a := TAU * i / 7.0
				_part(head, _cone(0.05, 0.2), mat, Vector3(sin(a) * 0.09, 0.24, cos(a) * 0.09 + 0.04), Vector3(cos(a) * 50 + 20, 0, -sin(a) * 50))
		"bald":
			pass


func _build_wings(chest: Node3D, kind: String, app: Dictionary) -> void:
	_wings = Node3D.new()
	chest.add_child(_wings)
	_wings.position = Vector3(0, 0.22, 0.16) * s
	var mat: Material
	match kind:
		"devil":
			mat = _toon(Color(0.06, 0.05, 0.07), 0.3)
		"bone":
			mat = _toon(Color(0.93, 0.9, 0.82), 0.3)
		_:
			mat = VFX.energy_material(app.get("aura_element", "wind"), 1.6, 0.6)
	var sides := [1.0] if kind == "bone" else [-1.0, 1.0]
	for side in sides:
		var w := Node3D.new()
		w.name = "wing_%s" % ("l" if side < 0 else "r")
		_wings.add_child(w)
		w.rotation_degrees = Vector3(0, -20 * side, 12 * side)
		if kind == "devil":
			# Bat-like: arm bone along the top, finger bones fanning down, membranes between.
			var membrane := _toon(Color(0.12, 0.05, 0.1), 0.8)
			membrane.cull_mode = BaseMaterial3D.CULL_DISABLED
			_part(w, _box(Vector3(1.0, 0.06, 0.05)), mat, Vector3(side * 0.5, 0.42, 0.05), Vector3(0, 0, side * 18))
			for i in 3:
				var ang: float = side * (-35.0 - i * 28.0)
				var tip: Vector3 = Vector3(side * (0.95 - i * 0.12), 0.58 - i * 0.05, 0.05)
				_part(w, _box(Vector3(0.04, 1.1 - i * 0.15, 0.04)), mat, tip + Vector3(sin(deg_to_rad(-ang)) * -0.5, -0.5, 0), Vector3(0, 0, ang))
				_part(w, _box(Vector3(0.42, 0.95 - i * 0.12, 0.012)), membrane, tip + Vector3(-side * 0.22, -0.48, 0.04), Vector3(0, 0, ang * 0.6))
		else:
			for i in 4:
				var len := 0.9 - i * 0.12
				_part(w, _box(Vector3(len, 0.05 + i * 0.01, 0.025)), mat,
					Vector3(side * (0.18 + len * 0.5), 0.35 - i * 0.18, 0.05), Vector3(0, 0, side * (30 - i * 22)))


# ---------------------------------------------------------------- animation

func set_pose(name: String, blend: float = 10.0) -> void:
	if _skinned and name != _target_pose:
		_skinned.play_pose(name)
	_target_pose = name
	_blend = blend


func flash_hit(amount: float = 0.9) -> void:
	_flash = amount
	if _skinned:
		_skinned.flash(amount)


func set_eye_glow(col: Color, energy: float) -> void:
	if _skinned:
		_skinned.set_eye_glow(col, energy)
	if _eye_mat == null:
		return
	_eye_mat.emission = col
	_eye_mat.albedo_color = col
	_eye_mat.emission_energy_multiplier = energy


func grimoire_glow(energy: float) -> void:
	if _grimoire_mat:
		_grimoire_mat.emission_energy_multiplier = energy


func hand_position(side: String = "r") -> Vector3:
	var h: Node3D = joints.get("hand_" + side)
	return h.global_position if h else global_position + Vector3(0, 1.2 * s, 0)


func _process(delta: float) -> void:
	if _skinned:
		_process_skinned(delta)
		return
	var pose: Dictionary = poses().get(_target_pose, {})
	var k := 1.0 - exp(-_blend * delta)
	_phase += delta * (7.5 * locomotion_rate) * maxf(locomotion, 0.15)
	var t := Time.get_ticks_msec() * 0.001
	var walk := locomotion
	for j in JOINTS:
		var target := Vector3.ZERO
		if pose.has(j):
			var a: Array = pose[j]
			target = Vector3(deg_to_rad(a[0]), deg_to_rad(a[1]), deg_to_rad(a[2]))
		if walk > 0.01 and not hovering:
			var sw := sin(_phase)
			match j:
				"thigh_l": target.x += sw * 0.55 * walk
				"thigh_r": target.x -= sw * 0.55 * walk
				"shin_l": target.x -= maxf(0.0, -sw) * 0.9 * walk
				"shin_r": target.x -= maxf(0.0, sw) * 0.9 * walk
				"upper_arm_l": target.x -= sw * 0.35 * walk
				"upper_arm_r": target.x += sw * 0.35 * walk
				"spine": target.y += sw * 0.08 * walk
		if j == "chest":
			target.x += sin(t * 1.8) * 0.025  # breathing
		_cur[j] = (_cur[j] as Vector3).lerp(target, k)
		var node: Node3D = joints.get(j)
		if node:
			node.rotation = _cur[j]
	var ry: float = float(pose.get("root_y", 0.0)) * s
	_root_y = lerpf(_root_y, ry, k)
	var bob := absf(sin(_phase)) * 0.04 * s * walk if not hovering else sin(t * 2.2) * 0.08 * s
	joints["hips"].position.y = _hip_base + _root_y + bob
	if _cape:
		_cape.rotation.x = lerpf(_cape.rotation.x, 0.15 + walk * 0.5 + sin(t * 2.3) * 0.05, 1.0 - exp(-4.0 * delta))
	if _grimoire:
		_grimoire.position.y = (1.3 + sin(t * 2.0) * 0.05) * s
		_grimoire.rotation.y = sin(t * 0.8) * 0.4
	if _wings:
		for w in _wings.get_children():
			var side := -1.0 if w.name.ends_with("l") else 1.0
			w.rotation.y = deg_to_rad(-20 * side) + sin(t * (5.0 if hovering else 1.5)) * 0.25 * side
	if _flash > 0.0:
		_flash = maxf(_flash - delta * 7.0, 0.0)
	for m in _mats:
		m.emission_energy_multiplier = _flash * 1.5


func _process_skinned(delta: float) -> void:
	_skinned.update(delta, locomotion)
	var t := Time.get_ticks_msec() * 0.001
	_skinned.position.y = sin(t * 2.2) * 0.08 * s if hovering else 0.0
	if _cape:
		_cape.rotation.x = lerpf(_cape.rotation.x, 0.15 + locomotion * 0.5 + sin(t * 2.3) * 0.05, 1.0 - exp(-4.0 * delta))
	if _grimoire:
		_grimoire.position.y = (1.3 + sin(t * 2.0) * 0.05) * s
		_grimoire.rotation.y = sin(t * 0.8) * 0.4
	if _wings:
		for w in _wings.get_children():
			var side := -1.0 if w.name.ends_with("l") else 1.0
			w.rotation.y = deg_to_rad(-20 * side) + sin(t * (5.0 if hovering else 1.5)) * 0.25 * side
	if _flash > 0.0:
		_flash = maxf(_flash - delta * 7.0, 0.0)
	for m in _mats:
		m.emission_energy_multiplier = _flash * 1.5
