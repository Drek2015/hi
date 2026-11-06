extends SceneTree
## Prints skeleton bones, meshes, materials and animations of an imported model.
## godot --headless --path game -s ../tools/godot/inspect_model.gd -- res://path/model.glb
func _init() -> void:
	var path: String = OS.get_cmdline_user_args()[0]
	var scene: PackedScene = load(path)
	var root := scene.instantiate()
	print("ROOT ", root.name, " ", root.get_class())
	for sk in root.find_children("*", "Skeleton3D", true, false):
		var s := sk as Skeleton3D
		var names := []
		for i in s.get_bone_count():
			names.append("%s<%s" % [s.get_bone_name(i), s.get_bone_name(s.get_bone_parent(i)) if s.get_bone_parent(i) >= 0 else "-"])
		print("SKELETON ", s.name, " bones=", s.get_bone_count())
		print("  ", ", ".join(names))
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var mats := []
		for i in m.mesh.get_surface_count():
			var mat := m.get_active_material(i)
			mats.append(mat.resource_name if mat else "null")
		print("MESH ", m.name, " surfaces=", m.mesh.get_surface_count(), " aabb=", m.get_aabb().size, " mats=", mats)
	for ap in root.find_children("*", "AnimationPlayer", true, false):
		print("ANIMS ", (ap as AnimationPlayer).get_animation_list())
	quit()
