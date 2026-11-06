extends Node
## Headless test suite. Run: tools/test.sh  (godot --headless --fixed-fps 240 res://tests/test_runner.tscn)
## 1) data validation (roster, animation clips, poses, modes)
## 2) progression math
## 3) per-boss simulation: a bot fights each boss, then every attack in every phase is forced once.

var failures: Array = []
var checks := 0


func check(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures.append(msg)
		printerr("FAIL: ", msg)


func _ready() -> void:
	Engine.max_fps = 0
	Settings.intro_cutscenes = false
	await get_tree().process_frame
	_test_data()
	_test_progression()
	var only := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--boss="):
			only = a.trim_prefix("--boss=")
	if only == "" or only == "yuno":
		await _test_cutscene("yuno")
	for b in Roster.bosses:
		if only == "" or b["id"] == only:
			await _simulate(b["id"])
	print("\n%d checks, %d failures" % [checks, failures.size()])
	for f in failures:
		print("  - ", f)
	get_tree().quit(1 if failures.size() > 0 else 0)


func _test_data() -> void:
	check(Roster.bosses.size() >= 8, "roster has 8+ bosses")
	for b in Roster.bosses:
		var problems: Array = Roster.validate(b)
		check(problems.is_empty(), "roster valid: %s %s" % [b.get("id"), problems])
		check(ArenaBuilder.THEMES.has(b["arena"]), "%s arena theme exists" % b["id"])
		for p in b["phases"]:
			for aid in p["attacks"]:
				check(float(b["attacks"][aid].get("weight", 1)) > 0.0, "%s.%s weight > 0 in phase pool" % [b["id"], aid])
	var anims := ViewModel.anims()
	for c in anims["clips"]:
		var clip: Dictionary = anims["clips"][c]
		for k in clip["keys"]:
			check(anims["poses"].has(k[0]), "clip %s: pose %s exists" % [c, k[0]])
			check(float(k[1]) <= float(clip["length"]) + 0.001, "clip %s: key within length" % c)
		for h in clip.get("hit", []):
			check(float(h) < float(clip["length"]), "clip %s: hit inside clip" % c)
	for m in AstaModes.ORDER:
		var md := AstaModes.get_mode(m)
		for a in md["light"] + [md["heavy"], md["q"], md["e"]]:
			check(anims["clips"].has(a["clip"]), "mode %s uses existing clip %s" % [m, a["clip"]])
	for pose in CharacterRig.poses():
		for j in CharacterRig.poses()[pose]:
			check(j == "root_y" or CharacterRig.JOINTS.has(j), "rig pose %s joint %s valid" % [pose, j])


func _test_progression() -> void:
	var saved := GameState.profile.duplicate(true)
	GameState.profile = GameState.default_profile()
	check(GameState.max_hp() == 800.0, "base HP is 800")
	var lv := GameState.add_xp(GameState.xp_to_next(1) + GameState.xp_to_next(2))
	check(lv == 2 and int(GameState.profile["level"]) == 3, "XP levels up twice")
	check(int(GameState.profile["unspent"]) == 4, "2 points per level")
	GameState.profile = saved


func _test_cutscene(id: String) -> void:
	print("== cutscene ", id)
	for f in DirAccess.get_files_at("res://data/cutscenes"):
		if f.ends_with(".json"):
			var d: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/cutscenes/" + f))
			check(d is Dictionary and not d.get("shots", []).is_empty(), "cutscene %s parses" % f)
			for shot in d.get("shots", []):
				for ev in shot.get("events", []):
					if ev.has("pose"):
						check(CharacterRig.poses().has(ev["pose"]), "cutscene %s pose %s exists" % [f, ev["pose"]])
					if ev.has("viewmodel"):
						check(ViewModel.clip_info(ev["viewmodel"]).size() > 0, "cutscene %s clip %s exists" % [f, ev["viewmodel"]])
	Settings.intro_cutscenes = true
	var arena := Arena.new().setup(id)
	add_child(arena)
	check(arena.in_cutscene, "%s intro cutscene starts" % id)
	check(arena.player.frozen, "player frozen during cutscene")
	await _run(20.0)
	check(not arena.in_cutscene, "%s intro cutscene finishes" % id)
	check(not arena.player.frozen, "player unfrozen after cutscene")
	check(arena.fight_time < 8.0, "fight timer paused during cutscene")
	Settings.intro_cutscenes = false
	arena.queue_free()
	await get_tree().process_frame
	GameState.reset_time()


func _simulate(id: String) -> void:
	print("== simulating ", id)
	var arena := Arena.new().setup(id)
	add_child(arena)
	var p: Player = arena.player
	var boss: Boss = arena.boss
	p.autopilot = load("res://tests/bot.gd").new()
	p.test_god = true
	boss._intro_time = 0.3
	var start_hp := boss.hp
	# Stage A: free fight.
	await _run(40.0)
	check(boss.hp < start_hp or not boss.is_alive(), "%s: Asta damaged the boss" % id)
	check(p.stats["damage_taken"] > 0.0, "%s: boss damaged Asta" % id)
	# Stage B: force every phase and every attack.
	var used := {}
	for pi in boss.def["phases"].size():
		if not boss.is_alive():
			break
		if pi > 0:
			boss.take_damage(boss.hp - boss.max_hp * float(boss.def["phases"][pi]["threshold"]) + 1.0, 0.0, Vector3.ZERO)
			await _run(3.0)
			check(boss.phase_idx == pi, "%s: entered phase %d" % [id, pi])
		for aid in boss.def["phases"][pi]["attacks"]:
			if not boss.is_alive():
				break
			used[aid] = true
			boss.state = "idle"
			boss.global_position = Vector3(0, 0.1, -6)
			p.global_position = Vector3(0, 0.1, 2)
			p.hp = p.max_hp
			boss.run_attack(aid)
			var t := 0.0
			while boss.state == "attack" and t < 10.0:
				await get_tree().physics_frame
				t += 1.0 / 240.0
			check(t < 10.0, "%s.%s finished in time" % [id, aid])
	check(used.size() > 0, "%s: exercised attacks" % id)
	# Kill the boss to cover death + results.
	if boss.is_alive():
		boss.take_damage(boss.hp + 10.0, 0.0, Vector3.ZERO)
	check(not boss.is_alive(), "%s: boss can die" % id)
	await _run(0.5)
	check(arena.projectiles.size() == 0, "%s: projectiles cleaned up on death" % id)
	arena.set_physics_process(false)
	arena.queue_free()
	await get_tree().process_frame
	GameState.reset_time()


func _run(seconds: float) -> void:
	var frames := int(seconds * 240.0)
	for i in frames:
		await get_tree().physics_frame
