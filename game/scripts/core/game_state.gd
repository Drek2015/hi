extends Node
## Player progression (RPG layer) + global game utilities. Autoloaded as `GameState`.

signal profile_changed

const STAT_KEYS := ["vigor", "endurance", "strength", "anti_magic"]
const STAT_LABELS := {
	"vigor": "Vigor", "endurance": "Endurance", "strength": "Strength", "anti_magic": "Anti-Magic",
}
const STAT_HELP := {
	"vigor": "Max HP", "endurance": "Max stamina + regen", "strength": "Sword damage",
	"anti_magic": "Gauge gain + mode efficiency",
}
const STAT_CAP := 60

var profile: Dictionary = {}
var selected_boss := "yuno"
var last_result: Dictionary = {}
var _hitstop_id := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	profile = default_profile()
	_load()


func default_profile() -> Dictionary:
	return {
		"version": 1, "name": "Asta", "level": 1, "xp": 0, "unspent": 0,
		"stats": {"vigor": 10, "endurance": 10, "strength": 10, "anti_magic": 10},
		"records": {},
	}


func _load() -> void:
	var p: Dictionary = await Backend.load_profile()
	if not p.is_empty():
		profile = _merge(default_profile(), p)
		profile_changed.emit()


func _merge(base: Dictionary, over: Dictionary) -> Dictionary:
	var out := base.duplicate(true)
	for k in over:
		if out.has(k) and out[k] is Dictionary and over[k] is Dictionary:
			out[k] = _merge(out[k], over[k])
		else:
			out[k] = over[k]
	return out


func save() -> void:
	Backend.save_profile(profile)


# ---------------------------------------------------------------- derived stats

func stat(key: String) -> int:
	return int(profile["stats"].get(key, 10))


func max_hp() -> float:
	return 500.0 + stat("vigor") * 30.0


func max_stamina() -> float:
	return 70.0 + stat("endurance") * 3.0


func stamina_regen() -> float:
	return 34.0 + stat("endurance") * 0.8


func damage_mult() -> float:
	return 1.0 + (stat("strength") - 10) * 0.035


func gauge_mult() -> float:
	return 1.0 + (stat("anti_magic") - 10) * 0.04


func xp_to_next(level: int) -> int:
	return int(round(300.0 * pow(level, 1.35)))


## Adds XP, returns number of levels gained. Each level grants 2 stat points.
func add_xp(amount: int) -> int:
	var gained := 0
	profile["xp"] = int(profile["xp"]) + amount
	while int(profile["xp"]) >= xp_to_next(int(profile["level"])):
		profile["xp"] = int(profile["xp"]) - xp_to_next(int(profile["level"]))
		profile["level"] = int(profile["level"]) + 1
		profile["unspent"] = int(profile["unspent"]) + 2
		gained += 1
	profile_changed.emit()
	return gained


func allocate(key: String) -> bool:
	if int(profile["unspent"]) <= 0 or not STAT_KEYS.has(key) or stat(key) >= STAT_CAP:
		return false
	profile["stats"][key] = stat(key) + 1
	profile["unspent"] = int(profile["unspent"]) - 1
	profile_changed.emit()
	save()
	return true


func record_for(boss_id: String) -> Dictionary:
	return profile["records"].get(boss_id, {"attempts": 0, "wins": 0, "best_time": 0.0})


## Stores a finished fight and returns the XP awarded.
func record_fight(boss_id: String, won: bool, time_seconds: float, stats: Dictionary) -> int:
	var rec := record_for(boss_id)
	rec["attempts"] = int(rec["attempts"]) + 1
	var xp := 0
	var boss := Roster.get_boss(boss_id)
	var diff: Dictionary = Settings.difficulty_data()
	if won:
		rec["wins"] = int(rec["wins"]) + 1
		if float(rec["best_time"]) <= 0.0 or time_seconds < float(rec["best_time"]):
			rec["best_time"] = time_seconds
		var first_win: bool = int(rec["wins"]) == 1
		xp = int(float(boss.get("xp", 800)) * float(diff["boss_hp"]) * (1.6 if first_win else 1.0))
	else:
		xp = int(float(boss.get("xp", 800)) * 0.12 * clampf(float(stats.get("boss_damage_pct", 0.0)), 0.0, 1.0))
	profile["records"][boss_id] = rec
	var levels := add_xp(xp)
	last_result = {
		"boss_id": boss_id, "won": won, "time_seconds": time_seconds, "xp": xp,
		"levels": levels, "stats": stats,
	}
	save()
	var fight := {
		"boss_id": boss_id, "won": won, "time_seconds": snappedf(time_seconds, 0.01),
		"difficulty": Settings.difficulty, "level": int(profile["level"]),
		"parries": int(stats.get("parries", 0)), "damage_taken": int(stats.get("damage_taken", 0)),
	}
	Backend.post_fight(fight)
	return xp


# ---------------------------------------------------------------- feel helpers

## Brief global slow-down on heavy impacts. Uses unscaled time so it always recovers.
func hitstop(duration: float, scale: float = 0.06) -> void:
	if get_tree().paused:
		return
	_hitstop_id += 1
	var my := _hitstop_id
	Engine.time_scale = minf(Engine.time_scale, scale)
	await get_tree().create_timer(duration, true, false, true).timeout
	if my == _hitstop_id:
		Engine.time_scale = 1.0


func reset_time() -> void:
	_hitstop_id += 1
	Engine.time_scale = 1.0
