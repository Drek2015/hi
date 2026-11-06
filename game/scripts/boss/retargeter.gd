class_name Retargeter
extends RefCounted
## Runtime animation retargeting between two humanoid skeletons with different bone names,
## rest poses and orientations (e.g. Quaternius RPG rig -> VRoid/VRM anime body).
##
## Per mapped bone, the source's rotation delta from its rest pose is transferred in a shared
## "rig space", after aligning each target bone's rest direction to the source's (so A-pose
## vs T-pose rests don't skew the limbs). Unmapped target bones keep their rest pose.

var src: Skeleton3D
var tgt: Skeleton3D
var pairs: Array = []            # [{s, t, q}]  q = rest-direction correction (rig space)
var _src_to_tgt: Dictionary = {}
var _order: PackedInt32Array      # target bones parent-first
var _ms: Basis                    # source skeleton space -> rig space (rotation only)
var _mt: Basis                    # target skeleton space -> rig space
var _a: Basis                     # source rig-space frame -> target rig-space frame (yaw)
var _src_rest_g: Dictionary = {}
var _tgt_rest_g: Dictionary = {}
var _hips_s := -1
var _hips_t := -1
var _hip_scale := 1.0
var _src_hip_rest := Vector3.ZERO
var _tgt_hip_rest := Vector3.ZERO


static func _rig_basis(node: Node3D, rig: Node3D) -> Basis:
	return (rig.global_transform.affine_inverse() * node.global_transform).basis.orthonormalized()


func setup(p_src: Skeleton3D, p_tgt: Skeleton3D, map: Dictionary, rig: Node3D) -> bool:
	src = p_src
	tgt = p_tgt
	_ms = _rig_basis(src, rig)
	_mt = _rig_basis(tgt, rig)
	for sname in map:
		var si := src.find_bone(sname)
		var ti := tgt.find_bone(map[sname])
		if si < 0 or ti < 0:
			continue
		_src_to_tgt[si] = ti
		_src_rest_g[si] = _ms * src.get_bone_global_rest(si).basis.orthonormalized()
		_tgt_rest_g[ti] = _mt * tgt.get_bone_global_rest(ti).basis.orthonormalized()
	if _src_to_tgt.size() < 8:
		return false
	# Facing alignment: rotate about Y so the source's character-right matches the target's.
	var rs := _bone_pos_rig(src, _ms, map, "UpperLeg.R") - _bone_pos_rig(src, _ms, map, "UpperLeg.L")
	var rt := _tgt_pos_rig(_ms_key(map, "UpperLeg.R")) - _tgt_pos_rig(_ms_key(map, "UpperLeg.L"))
	rs.y = 0
	rt.y = 0
	var yaw := atan2(rs.cross(rt).y, rs.dot(rt)) if rs.length() > 0.001 and rt.length() > 0.001 else 0.0
	_a = Basis(Vector3.UP, yaw)
	# Rest-direction correction per limb bone, using the first mapped child.
	for si in _src_to_tgt:
		var ti: int = _src_to_tgt[si]
		var q := Basis()
		var sc := _mapped_child(si)
		if sc >= 0:
			var ds: Vector3 = _a * (_ms * (src.get_bone_global_rest(sc).origin - src.get_bone_global_rest(si).origin))
			var dt: Vector3 = _mt * (tgt.get_bone_global_rest(_src_to_tgt[sc]).origin - tgt.get_bone_global_rest(ti).origin)
			if ds.length() > 1e-5 and dt.length() > 1e-5:
				q = _arc(dt.normalized(), ds.normalized())
		pairs.append({"s": si, "t": ti, "q": q})
	# Hips translation (vertical bob, crouches) scaled by hip height ratio.
	_hips_s = src.find_bone(_ms_key(map, "Hips"))
	_hips_t = tgt.find_bone(map.get(_ms_key(map, "Hips"), ""))
	if _hips_s >= 0 and _hips_t >= 0:
		_src_hip_rest = src.get_bone_global_rest(_hips_s).origin
		_tgt_hip_rest = tgt.get_bone_global_rest(_hips_t).origin
		var hs := (src.global_transform.basis * _src_hip_rest).y
		var ht := (tgt.global_transform.basis * _tgt_hip_rest).y
		_hip_scale = ht / hs if absf(hs) > 1e-5 else 1.0
	var depth := {}
	var idx: Array = range(tgt.get_bone_count())
	for i in idx:
		var d := 0
		var p := tgt.get_bone_parent(i)
		while p >= 0:
			d += 1
			p = tgt.get_bone_parent(p)
		depth[i] = d
	idx.sort_custom(func(a, b): return depth[a] < depth[b])
	_order = PackedInt32Array(idx)
	return true


func _ms_key(map: Dictionary, wanted: String) -> String:
	return wanted if map.has(wanted) else ""


func _bone_pos_rig(sk: Skeleton3D, m: Basis, _map: Dictionary, name: String) -> Vector3:
	var i := sk.find_bone(name)
	return m * sk.get_bone_global_rest(i).origin if i >= 0 else Vector3.ZERO


func _tgt_pos_rig(src_name: String) -> Vector3:
	var si := src.find_bone(src_name)
	if si < 0 or not _src_to_tgt.has(si):
		return Vector3.ZERO
	return _mt * tgt.get_bone_global_rest(_src_to_tgt[si]).origin


func _mapped_child(si: int) -> int:
	for c in src.get_bone_children(si):
		if _src_to_tgt.has(c):
			return c
	return -1


static func _arc(from: Vector3, to: Vector3) -> Basis:
	var axis := from.cross(to)
	var d := clampf(from.dot(to), -1.0, 1.0)
	if axis.length() < 1e-6:
		return Basis() if d > 0.0 else Basis(Vector3.UP, PI)
	return Basis(axis.normalized(), acos(d))


func update() -> void:
	var desired := {}  # target bone -> desired global basis (target skeleton space)
	var mt_inv := _mt.inverse()
	for p in pairs:
		var si: int = p["s"]
		var ti: int = p["t"]
		var pose_g: Basis = _ms * src.get_bone_global_pose(si).basis.orthonormalized()
		var delta: Basis = pose_g * (_src_rest_g[si] as Basis).inverse()
		var delta_t: Basis = _a * delta * _a.inverse()
		desired[ti] = mt_inv * (delta_t * (p["q"] as Basis) * (_tgt_rest_g[ti] as Basis))
	var global := {}
	for i in _order:
		var parent := tgt.get_bone_parent(i)
		var pg: Basis = global[parent] if parent >= 0 else Basis()
		var local_rest := tgt.get_bone_rest(i).basis
		var g: Basis
		if desired.has(i):
			g = desired[i]
			tgt.set_bone_pose_rotation(i, (pg.inverse() * g).get_rotation_quaternion())
		else:
			g = pg * local_rest
			tgt.set_bone_pose_rotation(i, local_rest.get_rotation_quaternion())
		global[i] = g
	if _hips_s >= 0 and _hips_t >= 0:
		# Vertical hip motion only (crouches, bobs, falls); horizontal root motion stays with the AI.
		var off_s := src.get_bone_global_pose(_hips_s).origin - _src_hip_rest
		var dy_world := (src.global_transform.basis * off_s).y * _hip_scale
		var off_tgt := tgt.global_transform.basis.inverse() * Vector3(0, dy_world, 0)
		var parent := tgt.get_bone_parent(_hips_t)
		var pb := tgt.get_bone_global_rest(parent).basis if parent >= 0 else Basis()
		tgt.set_bone_pose_position(_hips_t, tgt.get_bone_rest(_hips_t).origin + pb.inverse() * off_tgt)
