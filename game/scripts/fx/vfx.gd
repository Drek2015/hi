class_name VFX
## Shared visual-effects factory: materials, particle bursts, flashes, slash arcs, auras.
## Everything is procedural so the VFX agent can iterate in code + shaders.

const ELEMENTS := {
	"anti":    {"core": Color(0.02, 0.02, 0.025), "rim": Color(0.92, 0.94, 1.0), "dark": 1.0},
	"wind":    {"core": Color(0.55, 1.0, 0.8), "rim": Color(0.25, 0.95, 0.6), "dark": 0.0},
	"star":    {"core": Color(1.0, 0.95, 0.7), "rim": Color(1.0, 0.75, 0.25), "dark": 0.0},
	"bone":    {"core": Color(0.95, 0.92, 0.85), "rim": Color(0.65, 0.4, 1.0), "dark": 0.0},
	"blood":   {"core": Color(0.9, 0.05, 0.08), "rim": Color(1.0, 0.25, 0.3), "dark": 0.0},
	"curse":   {"core": Color(0.95, 0.2, 0.7), "rim": Color(0.6, 0.05, 0.4), "dark": 0.0},
	"body":    {"core": Color(0.85, 0.35, 0.45), "rim": Color(0.5, 0.05, 0.25), "dark": 0.0},
	"gravity": {"core": Color(0.35, 0.12, 0.85), "rim": Color(0.75, 0.45, 1.0), "dark": 0.6},
	"water":   {"core": Color(0.4, 0.75, 1.0), "rim": Color(0.15, 0.45, 1.0), "dark": 0.0},
	"dark":    {"core": Color(0.25, 0.05, 0.45), "rim": Color(0.6, 0.3, 1.0), "dark": 0.8},
	"shadow":  {"core": Color(0.05, 0.12, 0.14), "rim": Color(0.3, 0.95, 0.95), "dark": 0.8},
	"fire":    {"core": Color(1.0, 0.6, 0.2), "rim": Color(1.0, 0.25, 0.05), "dark": 0.0},
	"spatial": {"core": Color(0.6, 0.7, 1.0), "rim": Color(0.9, 0.95, 1.0), "dark": 0.3},
}

static var _shader_cache := {}
static var _soft_tex: GradientTexture2D


## Soft round sprite for every particle (hard quads look cheap).
static func soft_texture() -> GradientTexture2D:
	if _soft_tex == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		g.add_point(0.35, Color(1, 1, 1, 0.55))
		_soft_tex = GradientTexture2D.new()
		_soft_tex.gradient = g
		_soft_tex.fill = GradientTexture2D.FILL_RADIAL
		_soft_tex.fill_from = Vector2(0.5, 0.5)
		_soft_tex.fill_to = Vector2(0.5, 0.0)
		_soft_tex.width = 64
		_soft_tex.height = 64
	return _soft_tex


static func element(id: String) -> Dictionary:
	return ELEMENTS.get(id, ELEMENTS["wind"])


static func shader(path: String) -> Shader:
	if not _shader_cache.has(path):
		_shader_cache[path] = load(path)
	return _shader_cache[path]


static func energy_material(elem: String, intensity: float = 2.5, scroll: float = 1.5) -> ShaderMaterial:
	var e := element(elem)
	var m := ShaderMaterial.new()
	m.shader = shader("res://shaders/energy.gdshader")
	m.set_shader_parameter("core_color", e["core"])
	m.set_shader_parameter("rim_color", e["rim"])
	m.set_shader_parameter("intensity", intensity)
	m.set_shader_parameter("scroll_speed", scroll)
	m.set_shader_parameter("dark", e["dark"])
	return m


static func dark_core_material(rim: Color) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader("res://shaders/dark_core.gdshader")
	m.set_shader_parameter("rim", rim)
	return m


static func glow_material(c: Color, energy: float = 3.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = soft_texture()
	m.emission_texture = soft_texture()
	return m


## Builds a magic orb: dark/opaque core (for dark elements) + additive shell.
static func orb(elem: String, radius: float) -> Node3D:
	var root := Node3D.new()
	var e := element(elem)
	var shell := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = radius
	sm.height = radius * 2.0
	sm.radial_segments = 24
	sm.rings = 12
	shell.mesh = sm
	shell.material_override = energy_material(elem, 3.0, 2.5)
	shell.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(shell)
	if float(e["dark"]) > 0.5:
		var core := MeshInstance3D.new()
		var cm := SphereMesh.new()
		cm.radius = radius * 0.7
		cm.height = radius * 1.4
		core.mesh = cm
		core.material_override = dark_core_material(e["rim"])
		core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(core)
	return root


static func particles(color: Color, amount: int, lifetime: float, velocity: float, size: float,
		one_shot: bool = true, spread: float = 180.0, gravity: float = -2.0, emit_radius: float = 0.2) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = maxi(1, amount)
	p.lifetime = lifetime
	p.one_shot = one_shot
	p.explosiveness = 0.95 if one_shot else 0.0
	p.local_coords = false
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = spread
	pm.initial_velocity_min = velocity * 0.4
	pm.initial_velocity_max = velocity
	pm.gravity = Vector3(0, gravity, 0)
	pm.damping_min = 2.0
	pm.damping_max = 4.0
	pm.scale_min = 0.5
	pm.scale_max = 1.2
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = emit_radius
	var ramp := Gradient.new()
	ramp.set_color(0, Color(color, 1.0))
	ramp.set_color(1, Color(color, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = ramp
	pm.color_ramp = gt
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0))
	var ct := CurveTexture.new()
	ct.curve = curve
	pm.scale_curve = ct
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	q.material = glow_material(color, 4.0)
	p.draw_pass_1 = q
	return p


static func burst(parent: Node, pos: Vector3, color: Color, amount: int = 28, speed: float = 7.0, size: float = 0.18, lifetime: float = 0.6) -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var p := particles(color, amount, lifetime, speed, size)
	parent.add_child(p)
	p.global_position = pos
	p.emitting = true
	p.finished.connect(p.queue_free)


static func flash(parent: Node, pos: Vector3, color: Color, energy: float = 6.0, radius: float = 8.0, duration: float = 0.25) -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var l := OmniLight3D.new()
	l.light_color = color
	l.light_energy = energy
	l.omni_range = radius
	l.shadow_enabled = false
	parent.add_child(l)
	l.global_position = pos
	var tw := l.create_tween()
	tw.tween_property(l, "light_energy", 0.0, duration).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_EXPO)
	tw.tween_callback(l.queue_free)


## A crescent slash arc in world space (boss blades, Asta's sword waves).
static func slash_arc(parent: Node, xform: Transform3D, size: float, core: Color, edge: Color, duration: float = 0.3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	mi.mesh = q
	var m := ShaderMaterial.new()
	m.shader = shader("res://shaders/slash.gdshader")
	m.set_shader_parameter("core_color", core)
	m.set_shader_parameter("edge_color", edge)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_transform = xform
	if duration > 0.0:
		var tw := mi.create_tween()
		tw.tween_method(func(v: float): m.set_shader_parameter("life", v), 0.0, 1.0, duration)
		tw.parallel().tween_property(mi, "scale", Vector3.ONE * 1.25, duration)
		tw.tween_callback(mi.queue_free)
	return mi


## Expanding shell (transformations, phase changes, impacts).
static func shockwave(parent: Node, pos: Vector3, elem: String, radius: float, duration: float = 0.5) -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 1.0
	sm.height = 2.0
	mi.mesh = sm
	var m := energy_material(elem, 2.0, 3.0)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_position = pos
	mi.scale = Vector3.ONE * 0.3
	var tw := mi.create_tween()
	tw.tween_property(mi, "scale", Vector3.ONE * radius, duration).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_EXPO)
	tw.parallel().tween_method(func(v: float): m.set_shader_parameter("intensity", v), 2.5, 0.0, duration)
	tw.tween_callback(mi.queue_free)


## Persistent aura particles following a node (Black Form, Devil Union, boss phases).
static func aura(color: Color, amount: int = 40, radius: float = 0.5, size: float = 0.12, rise: float = 1.5) -> GPUParticles3D:
	var p := particles(color, amount, 0.9, rise, size, false, 25.0, 1.5, radius)
	p.emitting = true
	return p


static func float_text(parent: Node, pos: Vector3, text: String, color: Color, size: int = 64) -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.outline_size = 12
	l.modulate = color
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true
	l.pixel_size = 0.0009
	parent.add_child(l)
	l.global_position = pos + Vector3(randf_range(-0.3, 0.3), 0, randf_range(-0.3, 0.3))
	var tw := l.create_tween()
	tw.tween_property(l, "global_position", l.global_position + Vector3(0, 1.2, 0), 0.9).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.9).set_delay(0.35)
	tw.tween_callback(l.queue_free)
