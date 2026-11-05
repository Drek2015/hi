class_name ArenaBuilder
## Procedural boss arenas. Each theme sets sky, light, fog, floor and set dressing.
## Graphics quality presets scale GI, AO, volumetrics, shadows and prop density.
## The environment-artist agent adds themes here.

const RADIUS := 36.0

const THEMES := {
	"clover_ruins": {
		"label": "Ruins of the Clover Forest",
		"sky": {"top": "#3a6fb8", "horizon": "#f5b27a", "bottom": "#3a3028", "cloud": "#fff0e0", "cloud_shadow": "#8a7a90", "cover": 0.45,
				"moon": "#fff4e0", "moon_dir": [0.6, 0.5, 0.6], "moon_size": 0.0, "crescent": 0.0, "stars": 0.0},
		"sun": {"color": "#ffd2a0", "energy": 1.7, "pitch": -18.0, "yaw": 210.0},
		"ambient": 0.55, "fog": "#e8c8a8", "fog_density": 0.0012, "vfog": "#ffe8d0", "vfog_density": 0.0035,
		"floor": {"a": "#8a8274", "b": "#5f584e", "grout": "#2a261f", "moss": "#3a5a20", "moss_amount": 0.45, "emblem": "#e0b050", "emblem_energy": 0.25, "fissure": "#000000", "fissure_energy": 0.0},
		"props": ["pillars", "trees", "grass", "rocks"], "rock": "#6e675c", "pillar": "#a39a88",
		"motes": "#d8f0a0", "ground": "#3e4a24",
	},
	"spade_citadel": {
		"label": "Spade Kingdom — Citadel Rooftops",
		"sky": {"top": "#0b0614", "horizon": "#3a1a4a", "bottom": "#050308", "cloud": "#4a2a5a", "cloud_shadow": "#120818", "cover": 0.6,
				"moon": "#ff4a3a", "moon_dir": [0.4, 0.32, -0.85], "moon_size": 0.06, "crescent": 1.0, "stars": 0.7},
		"sun": {"color": "#b090ff", "energy": 0.7, "pitch": -35.0, "yaw": 30.0},
		"ambient": 0.45, "fog": "#2a1438", "fog_density": 0.004, "vfog": "#7a4a9a", "vfog_density": 0.012,
		"floor": {"a": "#3a3644", "b": "#1e1b26", "grout": "#0a080c", "moss": "#3a1a5a", "moss_amount": 0.12, "emblem": "#a050ff", "emblem_energy": 1.2, "fissure": "#a050ff", "fissure_energy": 0.4},
		"props": ["pillars", "crystals", "spires", "rocks"], "rock": "#2a2632", "pillar": "#3c3848",
		"motes": "#b080ff", "ground": "#120e18",
	},
	"hell_gate": {
		"label": "Gate of the Underworld",
		"sky": {"top": "#12030a", "horizon": "#7a1a10", "bottom": "#0a0202", "cloud": "#a03018", "cloud_shadow": "#200606", "cover": 0.7,
				"moon": "#ff3010", "moon_dir": [0.0, 0.35, -1.0], "moon_size": 0.13, "crescent": 0.0, "stars": 0.0},
		"sun": {"color": "#ffc0a0", "energy": 1.0, "pitch": -32.0, "yaw": 150.0},
		"ambient": 0.3, "fog": "#3a0a06", "fog_density": 0.0035, "vfog": "#ff6040", "vfog_density": 0.009,
		"floor": {"a": "#34302e", "b": "#1c1818", "grout": "#060404", "moss": "#1a0a08", "moss_amount": 0.2, "emblem": "#ff3020", "emblem_energy": 1.2, "fissure": "#ff4a10", "fissure_energy": 1.6},
		"props": ["gate", "obelisks", "rocks", "spires"], "rock": "#2a2020", "pillar": "#302626",
		"motes": "#ff7040", "ground": "#140808",
	},
	"bulls_training": {
		"label": "Black Bull Training Canyon",
		"sky": {"top": "#4a5a9a", "horizon": "#e88a60", "bottom": "#2a2020", "cloud": "#ffd0b0", "cloud_shadow": "#6a5070", "cover": 0.5,
				"moon": "#fff0e0", "moon_dir": [-0.5, 0.4, -0.7], "moon_size": 0.02, "crescent": 0.6, "stars": 0.15},
		"sun": {"color": "#ffb080", "energy": 1.5, "pitch": -13.0, "yaw": 160.0},
		"ambient": 0.55, "fog": "#c09080", "fog_density": 0.0015, "vfog": "#ffe0c8", "vfog_density": 0.003,
		"floor": {"a": "#9a8468", "b": "#6e5c48", "grout": "#3a2e22", "moss": "#6a6a30", "moss_amount": 0.15, "emblem": "#e8e8e8", "emblem_energy": 0.15, "fissure": "#000000", "fissure_energy": 0.0},
		"props": ["canyon", "posts", "banners", "rocks"], "rock": "#8a6a50", "pillar": "#6a4a30",
		"motes": "#ffe0b0", "ground": "#6a5038",
	},
}


static func col(hex: String) -> Color:
	return Color.from_string(hex, Color.MAGENTA)


static func build(root: Node3D, theme_id: String, quality: String) -> Dictionary:
	var t: Dictionary = THEMES.get(theme_id, THEMES["clover_ruins"])
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(theme_id)
	var env_node := WorldEnvironment.new()
	env_node.environment = _environment(t, quality)
	root.add_child(env_node)
	var sun := _sun(t, quality)
	root.add_child(sun)
	_floor(root, t)
	var rock_mat := _rock_material(col(t["rock"]))
	var pillar_mat := _rock_material(col(t["pillar"]), 0.6)
	var dens := {"low": 0.35, "medium": 0.6, "high": 1.0, "ultra": 1.4}.get(quality, 1.0)
	for p in t["props"]:
		match p:
			"pillars": _pillars(root, rng, pillar_mat)
			"trees": _trees(root, rng, dens)
			"grass": _grass(root, rng, dens, quality)
			"rocks": _rocks(root, rng, rock_mat, dens)
			"crystals": _crystals(root, rng, col(t["floor"]["emblem"]), dens)
			"spires": _spires(root, rng, rock_mat)
			"gate": _gate(root, col(t["floor"]["emblem"]))
			"obelisks": _obelisks(root, rng, pillar_mat, col(t["floor"]["fissure"]))
			"canyon": _canyon(root, rng, rock_mat)
			"posts": _posts(root, rng)
			"banners": _banners(root, rng)
	_boundary(root, col(t["motes"]))
	_motes(root, col(t["motes"]), dens)
	return {"label": t["label"], "env": env_node.environment, "sun": sun}


static func _environment(t: Dictionary, quality: String) -> Environment:
	var env := Environment.new()
	var sky_mat := ShaderMaterial.new()
	sky_mat.shader = VFX.shader("res://shaders/sky.gdshader")
	var s: Dictionary = t["sky"]
	sky_mat.set_shader_parameter("top_color", col(s["top"]))
	sky_mat.set_shader_parameter("horizon_color", col(s["horizon"]))
	sky_mat.set_shader_parameter("bottom_color", col(s["bottom"]))
	sky_mat.set_shader_parameter("cloud_color", col(s["cloud"]))
	sky_mat.set_shader_parameter("cloud_shadow", col(s["cloud_shadow"]))
	sky_mat.set_shader_parameter("cloud_cover", s["cover"])
	sky_mat.set_shader_parameter("moon_color", col(s["moon"]))
	sky_mat.set_shader_parameter("moon_dir", Vector3(s["moon_dir"][0], s["moon_dir"][1], s["moon_dir"][2]))
	sky_mat.set_shader_parameter("moon_size", s["moon_size"])
	sky_mat.set_shader_parameter("moon_crescent", s["crescent"])
	sky_mat.set_shader_parameter("star_amount", s["stars"])
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky.radiance_size = Sky.RADIANCE_SIZE_256
	sky.process_mode = Sky.PROCESS_MODE_QUALITY
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = t["ambient"]
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 0.95
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_strength = 1.1
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 1.1
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.set_glow_level(1, 1.0)
	env.set_glow_level(3, 0.8)
	env.set_glow_level(5, 0.6)
	env.fog_enabled = true
	env.fog_light_color = col(t["fog"])
	env.fog_density = t["fog_density"]
	env.fog_aerial_perspective = 0.2
	env.fog_sky_affect = 0.08
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.08
	env.adjustment_saturation = 1.12
	apply_quality(env, t, quality)
	return env


static func apply_quality(env: Environment, t: Dictionary, quality: String) -> void:
	var q := ["low", "medium", "high", "ultra"].find(quality)
	env.ssao_enabled = q >= 1
	env.ssao_radius = 1.2
	env.ssao_intensity = 2.2
	env.ssil_enabled = q >= 3
	env.ssr_enabled = q >= 3
	env.sdfgi_enabled = q >= 3
	env.sdfgi_use_occlusion = true
	env.sdfgi_cascades = 4
	env.volumetric_fog_enabled = q >= 2
	env.volumetric_fog_density = t["vfog_density"]
	env.volumetric_fog_albedo = col(t["vfog"])
	env.volumetric_fog_anisotropy = 0.6
	env.volumetric_fog_length = 80.0
	env.volumetric_fog_sky_affect = 0.0


static func _sun(t: Dictionary, quality: String) -> DirectionalLight3D:
	var l := DirectionalLight3D.new()
	var s: Dictionary = t["sun"]
	l.light_color = col(s["color"])
	l.light_energy = s["energy"]
	l.rotation_degrees = Vector3(s["pitch"], s["yaw"], 0)
	l.shadow_enabled = true
	l.shadow_blur = 1.2
	l.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL if quality == "low" else (DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS if quality == "medium" else DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS)
	l.directional_shadow_max_distance = 90.0
	l.light_volumetric_fog_energy = 1.4
	l.light_angular_distance = 0.6
	return l


static func _rock_material(c: Color, rough: float = 0.92) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	var n := FastNoiseLite.new()
	n.noise_type = FastNoiseLite.TYPE_CELLULAR
	n.frequency = 0.02
	n.fractal_octaves = 4
	var tex := NoiseTexture2D.new()
	tex.noise = n
	tex.seamless = true
	tex.width = 512
	tex.height = 512
	var ramp := Gradient.new()
	ramp.set_color(0, c.darkened(0.45))
	ramp.set_color(1, c.lightened(0.18))
	tex.color_ramp = ramp
	m.albedo_texture = tex
	var nt := NoiseTexture2D.new()
	nt.noise = n
	nt.seamless = true
	nt.as_normal_map = true
	nt.bump_strength = 6.0
	nt.width = 512
	nt.height = 512
	m.normal_enabled = true
	m.normal_texture = nt
	m.normal_scale = 1.2
	m.roughness = rough
	m.uv1_triplanar = true
	m.uv1_scale = Vector3(0.35, 0.35, 0.35)
	m.uv1_world_triplanar = true
	return m


static func _mesh(root: Node3D, mesh: Mesh, mat: Material, pos: Vector3, rot_deg: Vector3 = Vector3.ZERO, scl: Vector3 = Vector3.ONE, collide: bool = false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = rot_deg
	mi.scale = scl
	root.add_child(mi)
	if collide:
		mi.create_convex_collision()
	return mi


static func _floor(root: Node3D, t: Dictionary) -> void:
	var f: Dictionary = t["floor"]
	var m := ShaderMaterial.new()
	m.shader = VFX.shader("res://shaders/floor.gdshader")
	m.set_shader_parameter("stone_a", col(f["a"]))
	m.set_shader_parameter("stone_b", col(f["b"]))
	m.set_shader_parameter("grout", col(f["grout"]))
	m.set_shader_parameter("overgrowth", col(f["moss"]))
	m.set_shader_parameter("overgrowth_amount", f["moss_amount"])
	m.set_shader_parameter("emblem_color", col(f["emblem"]))
	m.set_shader_parameter("emblem_energy", f["emblem_energy"])
	m.set_shader_parameter("fissure_color", col(f["fissure"]))
	m.set_shader_parameter("fissure_energy", f["fissure_energy"])
	var disc := CylinderMesh.new()
	disc.top_radius = RADIUS + 4.0
	disc.bottom_radius = RADIUS + 5.0
	disc.height = 1.0
	disc.radial_segments = 96
	_mesh(root, disc, m, Vector3(0, -0.5, 0))
	# Outer ground plane.
	var g := PlaneMesh.new()
	g.size = Vector2(600, 600)
	var gm := _rock_material(col(t["ground"]), 1.0)
	gm.uv1_scale = Vector3(0.08, 0.08, 0.08)
	_mesh(root, g, gm, Vector3(0, -0.35, 0))
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(600, 1, 600)
	shape.shape = box
	shape.position.y = -0.5
	body.add_child(shape)
	root.add_child(body)


static func _pillars(root: Node3D, rng: RandomNumberGenerator, mat: Material) -> void:
	var count := 12
	for i in count:
		var ang := TAU * i / count + 0.13
		var r := RADIUS - 3.0
		var pos := Vector3(cos(ang) * r, 0, sin(ang) * r)
		var h := rng.randf_range(3.5, 11.0)
		var shaft := CylinderMesh.new()
		shaft.top_radius = 0.8
		shaft.bottom_radius = 0.9
		shaft.height = h
		shaft.radial_segments = 14
		_mesh(root, shaft, mat, pos + Vector3(0, h * 0.5, 0), Vector3(rng.randf_range(-3, 3), rng.randf() * 90, rng.randf_range(-3, 3)), Vector3.ONE, true)
		var base := BoxMesh.new()
		base.size = Vector3(2.4, 0.7, 2.4)
		_mesh(root, base, mat, pos + Vector3(0, 0.35, 0), Vector3(0, ang * 57.3, 0))
		if h > 8.0:
			var cap := BoxMesh.new()
			cap.size = Vector3(2.3, 0.6, 2.3)
			_mesh(root, cap, mat, pos + Vector3(0, h + 0.3, 0), Vector3(0, ang * 57.3, 0))
		if rng.randf() < 0.35:
			var fallen := CylinderMesh.new()
			fallen.top_radius = 0.75
			fallen.bottom_radius = 0.8
			fallen.height = rng.randf_range(3.0, 6.0)
			var fp := pos * 1.12 + Vector3(0, 0.75, 0)
			_mesh(root, fallen, mat, fp, Vector3(0, rng.randf() * 180, 90), Vector3.ONE, false)


static func _trees(root: Node3D, rng: RandomNumberGenerator, dens: float) -> void:
	var bark := _rock_material(Color(0.28, 0.2, 0.14), 0.95)
	var leaf := ShaderMaterial.new()
	leaf.shader = VFX.shader("res://shaders/foliage.gdshader")
	leaf.set_shader_parameter("base_color", Color(0.1, 0.22, 0.06))
	leaf.set_shader_parameter("tip_color", Color(0.45, 0.6, 0.18))
	leaf.set_shader_parameter("sway", 0.25)
	leaf.set_shader_parameter("height", 6.0)
	for i in int(46 * dens):
		var ang := rng.randf() * TAU
		var r := rng.randf_range(RADIUS + 8.0, RADIUS + 60.0)
		var pos := Vector3(cos(ang) * r, 0, sin(ang) * r)
		var h := rng.randf_range(9.0, 18.0)
		var trunk := CylinderMesh.new()
		trunk.top_radius = 0.35
		trunk.bottom_radius = 0.8
		trunk.height = h
		_mesh(root, trunk, bark, pos + Vector3(0, h * 0.5, 0), Vector3(rng.randf_range(-4, 4), 0, rng.randf_range(-4, 4)))
		for k in rng.randi_range(4, 7):
			var blob := SphereMesh.new()
			var br := rng.randf_range(2.2, 4.2)
			blob.radius = br
			blob.height = br * 1.6
			_mesh(root, blob, leaf, pos + Vector3(rng.randf_range(-2.5, 2.5), h + rng.randf_range(-2.5, 1.5), rng.randf_range(-2.5, 2.5)))


static func _grass(root: Node3D, rng: RandomNumberGenerator, dens: float, quality: String) -> void:
	if quality == "low":
		return
	var blade := ArrayMesh.new()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := [Vector3(-0.05, 0, 0), Vector3(0.05, 0, 0), Vector3(0.0, 0.55, 0.04)]
	var uvs := [Vector2(0, 1), Vector2(1, 1), Vector2(0.5, 0)]
	for i in 3:
		st.set_normal(Vector3(0, 0.3, 1).normalized())
		st.set_uv(uvs[i])
		st.add_vertex(pts[i])
	st.commit(blade)
	var mat := ShaderMaterial.new()
	mat.shader = VFX.shader("res://shaders/foliage.gdshader")
	mat.set_shader_parameter("base_color", Color(0.12, 0.2, 0.05))
	mat.set_shader_parameter("tip_color", Color(0.55, 0.62, 0.25))
	mat.set_shader_parameter("sway", 0.1)
	mat.set_shader_parameter("height", 0.55)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = blade
	mm.instance_count = int(16000 * dens)
	for i in mm.instance_count:
		var ang := rng.randf() * TAU
		var r := sqrt(rng.randf()) * 40.0 + RADIUS - 2.0
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.7, 1.6))
		mm.set_instance_transform(i, Transform3D(b, Vector3(cos(ang) * r, -0.3 if r > RADIUS + 4.0 else 0.0, sin(ang) * r)))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mmi)


static func _rocks(root: Node3D, rng: RandomNumberGenerator, mat: Material, dens: float) -> void:
	for i in int(70 * dens):
		var ang := rng.randf() * TAU
		var r := rng.randf_range(RADIUS + 3.0, RADIUS + 30.0)
		var s := rng.randf_range(1.0, 5.5) * (1.0 + (r - RADIUS) / 30.0)
		var m := SphereMesh.new()
		m.radius = 1.0
		m.height = 1.4
		m.radial_segments = 7
		m.rings = 4
		_mesh(root, m, mat, Vector3(cos(ang) * r, s * 0.15, sin(ang) * r), Vector3(rng.randf() * 40, rng.randf() * 360, rng.randf() * 40), Vector3(s * rng.randf_range(0.8, 1.6), s * rng.randf_range(0.5, 1.0), s))
	for i in int(24 * dens):  # rubble inside the arena edge
		var ang := rng.randf() * TAU
		var r := rng.randf_range(RADIUS - 6.0, RADIUS + 2.0)
		var b := BoxMesh.new()
		b.size = Vector3.ONE * rng.randf_range(0.3, 0.9)
		_mesh(root, b, mat, Vector3(cos(ang) * r, 0.15, sin(ang) * r), Vector3(rng.randf() * 60, rng.randf() * 360, rng.randf() * 60))


static func _crystals(root: Node3D, rng: RandomNumberGenerator, c: Color, dens: float) -> void:
	var m := StandardMaterial3D.new()
	m.albedo_color = c.darkened(0.5)
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = 2.2
	m.roughness = 0.15
	m.metallic = 0.3
	m.rim_enabled = true
	for i in int(30 * dens):
		var ang := rng.randf() * TAU
		var r := rng.randf_range(RADIUS - 1.0, RADIUS + 18.0)
		var base := Vector3(cos(ang) * r, 0, sin(ang) * r)
		for k in rng.randi_range(2, 5):
			var p := PrismMesh.new()
			var h := rng.randf_range(1.5, 6.0)
			p.size = Vector3(0.6, h, 0.6)
			_mesh(root, p, m, base + Vector3(rng.randf_range(-1, 1), h * 0.45, rng.randf_range(-1, 1)), Vector3(rng.randf_range(-25, 25), rng.randf() * 360, rng.randf_range(-25, 25)))
		if i % 6 == 0:
			var l := OmniLight3D.new()
			l.light_color = c
			l.light_energy = 1.5
			l.omni_range = 9.0
			l.position = base + Vector3(0, 2, 0)
			root.add_child(l)


static func _spires(root: Node3D, rng: RandomNumberGenerator, mat: Material) -> void:
	for i in 18:
		var ang := rng.randf() * TAU
		var r := rng.randf_range(80.0, 160.0)
		var h := rng.randf_range(30.0, 90.0)
		var c := CylinderMesh.new()
		c.top_radius = 0.0
		c.bottom_radius = rng.randf_range(4.0, 9.0)
		c.height = h
		c.radial_segments = 6
		_mesh(root, c, mat, Vector3(cos(ang) * r, h * 0.5 - 2.0, sin(ang) * r))


static func _gate(root: Node3D, c: Color) -> void:
	var stone := _rock_material(Color(0.18, 0.14, 0.14), 0.9)
	var t := TorusMesh.new()
	t.inner_radius = 26.0
	t.outer_radius = 31.0
	t.rings = 64
	t.ring_segments = 12
	_mesh(root, t, stone, Vector3(0, 30, -95), Vector3(90, 0, 0))
	var portal := CylinderMesh.new()
	portal.top_radius = 26.0
	portal.bottom_radius = 26.0
	portal.height = 0.5
	portal.radial_segments = 64
	var m := VFX.energy_material("blood", 1.4, 0.3)
	_mesh(root, portal, m, Vector3(0, 30, -95.5), Vector3(90, 0, 0))
	var l := OmniLight3D.new()
	l.light_color = c
	l.light_energy = 2.0
	l.omni_range = 70.0
	l.position = Vector3(0, 28, -80)
	root.add_child(l)


static func _obelisks(root: Node3D, rng: RandomNumberGenerator, mat: Material, glow: Color) -> void:
	var gm := VFX.glow_material(glow, 3.0)
	gm.billboard_mode = BaseMaterial3D.BILLBOARD_DISABLED
	gm.blend_mode = BaseMaterial3D.BLEND_MODE_MIX
	gm.transparency = BaseMaterial3D.TRANSPARENCY_DISABLED
	for i in 8:
		var ang := TAU * i / 8.0 + 0.2
		var r := RADIUS - 2.5
		var h := rng.randf_range(5.0, 9.0)
		var b := BoxMesh.new()
		b.size = Vector3(1.3, h, 1.3)
		var pos := Vector3(cos(ang) * r, h * 0.5, sin(ang) * r)
		_mesh(root, b, mat, pos, Vector3(rng.randf_range(-6, 6), ang * 57.3, rng.randf_range(-6, 6)), Vector3.ONE, true)
		var rune := BoxMesh.new()
		rune.size = Vector3(1.32, 0.15, 1.32)
		_mesh(root, rune, gm, pos + Vector3(0, h * 0.2, 0), Vector3(0, ang * 57.3, 0))


static func _canyon(root: Node3D, rng: RandomNumberGenerator, mat: Material) -> void:
	for i in 40:
		var ang := TAU * i / 40.0
		var r := rng.randf_range(RADIUS + 10.0, RADIUS + 22.0)
		var h := rng.randf_range(14.0, 34.0)
		var b := BoxMesh.new()
		b.size = Vector3(rng.randf_range(8, 16), h, rng.randf_range(6, 12))
		_mesh(root, b, mat, Vector3(cos(ang) * r, h * 0.45, sin(ang) * r), Vector3(rng.randf_range(-8, 8), -ang * 57.3, rng.randf_range(-8, 8)))


static func _posts(root: Node3D, rng: RandomNumberGenerator) -> void:
	var wood := _rock_material(Color(0.36, 0.25, 0.15), 0.95)
	for i in 14:
		var ang := rng.randf() * TAU
		var r := rng.randf_range(RADIUS - 5.0, RADIUS - 1.0)
		var c := CylinderMesh.new()
		c.top_radius = 0.22
		c.bottom_radius = 0.26
		c.height = rng.randf_range(1.6, 2.6)
		_mesh(root, c, wood, Vector3(cos(ang) * r, c.height * 0.5, sin(ang) * r), Vector3(rng.randf_range(-8, 8), 0, rng.randf_range(-8, 8)), Vector3.ONE, true)


static func _banners(root: Node3D, rng: RandomNumberGenerator) -> void:
	var cloth := StandardMaterial3D.new()
	cloth.albedo_color = Color(0.05, 0.05, 0.05)
	cloth.roughness = 1.0
	cloth.cull_mode = BaseMaterial3D.CULL_DISABLED
	var emblem := StandardMaterial3D.new()
	emblem.albedo_color = Color(0.85, 0.85, 0.82)
	var pole := _rock_material(Color(0.3, 0.22, 0.14))
	for i in 6:
		var ang := TAU * i / 6.0 + 0.5
		var r := RADIUS + 1.0
		var base := Vector3(cos(ang) * r, 0, sin(ang) * r)
		var c := CylinderMesh.new()
		c.top_radius = 0.1
		c.bottom_radius = 0.12
		c.height = 9.0
		_mesh(root, c, pole, base + Vector3(0, 4.5, 0))
		var flag := BoxMesh.new()
		flag.size = Vector3(2.2, 3.5, 0.03)
		_mesh(root, flag, cloth, base + Vector3(0, 6.8, 0) - base.normalized() * 1.15, Vector3(0, -ang * 57.3 + 90, rng.randf_range(-4, 4)))
		var mark := SphereMesh.new()
		mark.radius = 0.45
		mark.height = 0.9
		_mesh(root, mark, emblem, base + Vector3(0, 7.0, 0) - base.normalized() * 1.15, Vector3(0, -ang * 57.3 + 90, 0), Vector3(1, 1, 0.08))


static func _boundary(root: Node3D, c: Color) -> void:
	var wall := CylinderMesh.new()
	wall.top_radius = RADIUS + 0.5
	wall.bottom_radius = RADIUS + 0.5
	wall.height = 6.0
	wall.radial_segments = 96
	wall.cap_top = false
	wall.cap_bottom = false
	var m := ShaderMaterial.new()
	m.shader = VFX.shader("res://shaders/energy.gdshader")
	m.set_shader_parameter("core_color", Color(c, 1.0) * 0.08)
	m.set_shader_parameter("rim_color", c * 0.25)
	m.set_shader_parameter("intensity", 0.35)
	m.set_shader_parameter("noise_scale", 8.0)
	m.set_shader_parameter("scroll_speed", 0.15)
	var mi := _mesh(root, wall, m, Vector3(0, 3.0, 0))
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


static func _motes(root: Node3D, c: Color, dens: float) -> void:
	var p := VFX.particles(c, int(220 * dens), 9.0, 0.4, 0.07, false, 180.0, 0.05, 1.0)
	var pm: ParticleProcessMaterial = p.process_material
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(RADIUS, 6.0, RADIUS)
	pm.turbulence_enabled = true
	pm.turbulence_noise_strength = 0.6
	p.visibility_aabb = AABB(Vector3(-60, -10, -60), Vector3(120, 30, 120))
	p.position = Vector3(0, 5, 0)
	p.preprocess = 6.0
	p.emitting = true
	root.add_child(p)
