class_name SkinnedBody
extends Node3D
## A skinned anime character (VRoid/VRM, CC0 samples) animated by retargeting the Quaternius RPG
## animation set (CC0). Boss AI keeps speaking in pose names; POSES maps them to clip segments.

const ANIM_SOURCES := [
	"res://assets/animations/quaternius_rpg/Warrior.fbx",
	"res://assets/animations/quaternius_rpg/Wizard.fbx",
	"res://assets/animations/quaternius_rpg/Monk.fbx",
]
const BONE_MAP := {
	"Hips": "J_Bip_C_Hips", "Abdomen": "J_Bip_C_Spine", "Torso": "J_Bip_C_Chest",
	"Neck": "J_Bip_C_Neck", "Head": "J_Bip_C_Head",
	"Shoulder.L": "J_Bip_L_Shoulder", "UpperArm.L": "J_Bip_L_UpperArm", "LowerArm.L": "J_Bip_L_LowerArm", "Fist.L": "J_Bip_L_Hand",
	"Shoulder.R": "J_Bip_R_Shoulder", "UpperArm.R": "J_Bip_R_UpperArm", "LowerArm.R": "J_Bip_R_LowerArm", "Fist.R": "J_Bip_R_Hand",
	"UpperLeg.L": "J_Bip_L_UpperLeg", "LowerLeg.L": "J_Bip_L_LowerLeg", "Foot.L": "J_Bip_L_Foot",
	"UpperLeg.R": "J_Bip_R_UpperLeg", "LowerLeg.R": "J_Bip_R_LowerLeg", "Foot.R": "J_Bip_R_Foot",
}
const ATTACH := {"hips": "J_Bip_C_Hips", "chest": "J_Bip_C_UpperChest", "head": "J_Bip_C_Head", "hand_r": "J_Bip_R_Hand", "hand_l": "J_Bip_L_Hand"}
## pose -> [clip, from (0..1), to (0..1), speed, loop]
const POSES := {
	"idle": ["Idle", 0.0, 1.0, 1.0, true],
	"combat": ["Idle_Attacking", 0.0, 1.0, 1.0, true],
	"guard": ["Idle_Weapon", 0.0, 1.0, 1.0, true],
	"taunt": ["Idle_Weapon", 0.0, 1.0, 1.0, true],
	"hover": ["Idle", 0.0, 1.0, 0.7, true],
	"windup_r": ["Sword_Attack", 0.0, 0.4, 0.8, false],
	"slash_r": ["Sword_Attack", 0.4, 1.0, 1.5, false],
	"windup_l": ["Sword_AttackFast", 0.0, 0.35, 0.8, false],
	"slash_l": ["Sword_AttackFast", 0.35, 1.0, 1.5, false],
	"thrust": ["Attack", 0.15, 1.0, 1.4, false],
	"cast_charge_r": ["Spell", 0.0, 0.45, 0.8, false],
	"cast_r": ["Spell", 0.45, 1.0, 1.3, false],
	"cast_both": ["Spell", 0.45, 1.0, 1.0, false],
	"cast_overhead": ["Spell", 0.15, 0.55, 0.6, false],
	"slam_windup": ["Staff_Attack", 0.0, 0.45, 0.8, false],
	"slam": ["Staff_Attack", 0.45, 1.0, 1.5, false],
	"dash": ["Run_Weapon", 0.0, 1.0, 1.5, true],
	"kneel": ["RecieveHit", 0.0, 0.55, 0.6, false],
	"recoil": ["RecieveHit_Attacking", 0.0, 1.0, 1.2, false],
	"death": ["Death", 0.0, 1.0, 0.8, false],
}
const LOOPING := ["Idle", "Idle_Attacking", "Idle_Weapon", "Walk", "Run", "Run_Weapon"]
const PREFIX := "CharacterArmature|"

var joints: Dictionary = {}
var model_scale := 1.0
var _model: Node3D
var _skel: Skeleton3D
var _src_root: Node3D
var _player: AnimationPlayer
var _retarget: Retargeter
var _mats: Array[ShaderMaterial] = []
var _iris: Array[ShaderMaterial] = []
var _pose := "idle"
var _clip := ""
var _seg_end := 1.0
var _loop := true
var _flash := 0.0


static func available(app: Dictionary) -> bool:
	return app.has("model") and ResourceLoader.exists(_model_path(app)) and ResourceLoader.exists(ANIM_SOURCES[0])


static func _model_path(app: Dictionary) -> String:
	return "res://assets/characters/%s.glb" % app.get("model", "")


func build(app: Dictionary, s: float) -> bool:
	_model = (load(_model_path(app)) as PackedScene).instantiate()
	add_child(_model)
	var sk := _model.find_children("*", "Skeleton3D", true, false)
	if sk.is_empty():
		return false
	_skel = sk[0]
	# Face the rig's -Z and scale to the boss height (rig baseline 1.85 m at height 1.0).
	var head := _skel.find_bone("J_Bip_C_Head")
	var eye := _skel.find_bone("J_Adj_L_FaceEye")
	var flipped := eye >= 0 and head >= 0 and _skel.get_bone_global_rest(eye).origin.z > _skel.get_bone_global_rest(head).origin.z
	if flipped:
		_model.rotation.y = PI
	var top := _skel.get_bone_global_rest(head).origin.y + 0.13 if head >= 0 else 1.7
	model_scale = 1.85 * s / maxf(top, 0.5)
	_model.scale = Vector3.ONE * model_scale
	_restyle(app)
	_build_attachments(flipped)
	return _build_animation()


# ---------------------------------------------------------------- looks

func _restyle(app: Dictionary) -> void:
	var shader: Shader = load("res://shaders/anime_toon.gdshader")
	var hair := Color.from_string(str(app.get("hair_color", "#222222")), Color.BLACK)
	var top := Color.from_string(str(app.get("outfit_primary", "#333333")), Color.DIM_GRAY)
	var bottom := Color.from_string(str(app.get("outfit_secondary", "#333333")), Color.DIM_GRAY)
	var dress := Color.from_string(str(app.get("dress_color", app.get("outfit_primary", "#ffffff"))), Color.WHITE)
	var boots := Color.from_string(str(app.get("boots", "#1a1512")), Color.BLACK)
	var accent := Color.from_string(str(app.get("accent", "#c9a24a")), Color.GOLD)
	var eyes := Color.from_string(str(app.get("eye_color", "#ffd060")), Color.GOLD)
	var skin := Color.from_string(str(app.get("skin", "#f0d0b8")), Color.WHITE)
	var rim := Color.from_string(str(app.get("aura_color", "#ffffff")), Color.WHITE) * 0.55
	var outline := StandardMaterial3D.new()
	outline.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	outline.albedo_color = Color(0.03, 0.02, 0.03)
	outline.cull_mode = BaseMaterial3D.CULL_FRONT
	outline.grow = true
	outline.grow_amount = 0.006
	for mi in _model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		_merge_surfaces(m)
		for i in m.mesh.get_surface_count():
			var src := m.get_active_material(i)
			var name := (src.resource_name if src else "").to_upper()
			var mat := ShaderMaterial.new()
			mat.shader = shader
			if src is BaseMaterial3D and (src as BaseMaterial3D).albedo_texture:
				mat.set_shader_parameter("albedo_tex", (src as BaseMaterial3D).albedo_texture)
			var lined := false
			if not name.contains("EYE") and not name.contains("FACE"):
				mat.set_shader_parameter("rim_glow", rim)
			if name.contains("HAIR"):
				mat.set_shader_parameter("tint", hair)
				mat.set_shader_parameter("recolor", 1.0)
			elif name.contains("EYEIRIS"):
				mat.set_shader_parameter("tint", eyes)
				mat.set_shader_parameter("recolor", 0.85)
				mat.set_shader_parameter("emission_color", eyes)
				mat.set_shader_parameter("emission_energy", 1.2)
				_iris.append(mat)
			elif name.contains("EYEEXTRA"):
				mat.set_shader_parameter("alpha_cut", 0.95)
			elif name.contains("TOPS"):
				mat.set_shader_parameter("tint", top)
				mat.set_shader_parameter("recolor", 1.0)
				lined = true
			elif name.contains("ONEPICE"):
				mat.set_shader_parameter("tint", dress if app.get("outfit", "") == "dress" else top)
				mat.set_shader_parameter("recolor", 1.0)
				lined = true
			elif name.contains("BOTTOMS"):
				mat.set_shader_parameter("tint", bottom)
				mat.set_shader_parameter("recolor", 1.0)
				lined = true
			elif name.contains("SHOES"):
				mat.set_shader_parameter("tint", boots)
				mat.set_shader_parameter("recolor", 1.0)
				lined = true
			elif name.contains("ACCESSORY"):
				mat.set_shader_parameter("tint", accent)
				mat.set_shader_parameter("recolor", 1.0)
			elif name.contains("BODY") and name.contains("SKIN"):
				mat.set_shader_parameter("tint", Color.WHITE.lerp(skin, 0.35))
				lined = true
			elif name.contains("SKIN"):
				mat.set_shader_parameter("tint", Color.WHITE.lerp(skin, 0.35))
			if lined:
				mat.next_pass = outline
			m.set_surface_override_material(i, mat)
			_mats.append(mat)


## VRoid hair arrives as ~100 surfaces sharing one material; merge them into one draw call.
func _merge_surfaces(m: MeshInstance3D) -> void:
	var mesh := m.mesh as ArrayMesh
	if mesh == null or mesh.get_surface_count() < 8 or mesh.get_blend_shape_count() > 0:
		return
	var groups := {}
	for i in mesh.get_surface_count():
		var mat := mesh.surface_get_material(i)
		var key := mat.resource_name if mat else ""
		if not groups.has(key):
			groups[key] = []
		groups[key].append(i)
	var merged := ArrayMesh.new()
	for key in groups:
		var idx: Array = groups[key]
		var st := SurfaceTool.new()
		st.create_from(mesh, idx[0])
		for k in range(1, idx.size()):
			st.append_from(mesh, idx[k], Transform3D.IDENTITY)
		st.commit(merged)
		merged.surface_set_material(merged.get_surface_count() - 1, mesh.surface_get_material(idx[0]))
	m.mesh = merged


func _build_attachments(flipped: bool) -> void:
	for key in ATTACH:
		var b := _skel.find_bone(ATTACH[key])
		if b < 0:
			continue
		var att := BoneAttachment3D.new()
		att.bone_name = ATTACH[key]
		_skel.add_child(att)
		var holder := Node3D.new()
		holder.name = key
		holder.rotation.y = PI if flipped else 0.0
		holder.scale = Vector3.ONE / model_scale
		att.add_child(holder)
		joints[key] = holder


# ---------------------------------------------------------------- animation

func _build_animation() -> bool:
	_src_root = (load(ANIM_SOURCES[0]) as PackedScene).instantiate()
	add_child(_src_root)
	for mi in _src_root.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).visible = false
	var aps := _src_root.find_children("*", "AnimationPlayer", true, false)
	var src_sk := _src_root.find_children("*", "Skeleton3D", true, false)
	if aps.is_empty() or src_sk.is_empty():
		return false
	_player = aps[0]
	var lib := _player.get_animation_library("")
	for path in ANIM_SOURCES.slice(1):
		if not ResourceLoader.exists(path):
			continue
		var extra: Node = (load(path) as PackedScene).instantiate()
		var ap := extra.find_children("*", "AnimationPlayer", true, false)
		if not ap.is_empty():
			for n in (ap[0] as AnimationPlayer).get_animation_list():
				if not lib.has_animation(n):
					lib.add_animation(n, (ap[0] as AnimationPlayer).get_animation(n))
		extra.free()
	for n in LOOPING:
		var a := lib.get_animation(PREFIX + n) if lib.has_animation(PREFIX + n) else null
		if a:
			a.loop_mode = Animation.LOOP_LINEAR
	_player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	_retarget = Retargeter.new()
	if not _retarget.setup(src_sk[0], _skel, BONE_MAP, get_parent() as Node3D):
		return false
	play_pose("idle")
	return true


func _play(clip: String, from: float, to: float, speed: float, loop: bool, blend: float = 0.15) -> void:
	var full := PREFIX + clip
	if not _player.has_animation(full):
		return
	var length := _player.get_animation(full).length
	_clip = clip
	_loop = loop
	_seg_end = to * length
	_player.play(full, blend, speed)
	_player.seek(from * length, true)


func play_pose(pose: String) -> void:
	if not POSES.has(pose):
		pose = "combat"
	_pose = pose
	var p: Array = POSES[pose]
	_play(p[0], p[1], p[2], p[3], p[4])


func update(delta: float, locomotion: float) -> void:
	if _player == null:
		return
	# Locomotion overrides idle-type poses.
	if _pose in ["idle", "combat", "guard", "taunt"]:
		var want := POSES[_pose][0] as String
		if locomotion > 0.6:
			want = "Run_Weapon" if _pose != "idle" else "Run"
		elif locomotion > 0.15:
			want = "Walk"
		if want != _clip:
			_play(want, 0.0, 1.0, 1.0, true, 0.2)
	if not _loop and _player.current_animation_position >= _seg_end:
		_player.speed_scale = 0.0
	else:
		_player.speed_scale = 1.0
	_player.advance(delta)
	_retarget.update()
	if _flash > 0.0:
		_flash = maxf(_flash - delta * 7.0, 0.0)
		for m in _mats:
			m.set_shader_parameter("flash", _flash * 0.8)


func flash(amount: float) -> void:
	_flash = amount


func set_eye_glow(col: Color, energy: float) -> void:
	for m in _iris:
		m.set_shader_parameter("emission_color", col)
		m.set_shader_parameter("emission_energy", energy * 0.4)
