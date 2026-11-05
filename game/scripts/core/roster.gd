extends Node
## Loads the boss roster (data/roster.json). Autoloaded as `Roster`.
## The roster is pure data so the boss-designer agent can add or tune fights
## without touching code. See docs/ASSET_PIPELINE.md for the schema.

const PATH := "res://data/roster.json"
const ATTACK_TYPES := ["melee", "volley", "aoe", "ring", "beam", "teleport", "pull", "summon", "regen", "combo"]

var bosses: Array = []
var _by_id: Dictionary = {}


func _ready() -> void:
	load_roster()


func load_roster() -> void:
	bosses.clear()
	_by_id.clear()
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		push_error("Roster: cannot open %s" % PATH)
		return
	var data: Variant = JSON.parse_string(f.get_as_text())
	if not (data is Dictionary) or not data.has("bosses"):
		push_error("Roster: invalid JSON in %s" % PATH)
		return
	bosses = data["bosses"]
	for b in bosses:
		_by_id[b["id"]] = b


func get_boss(id: String) -> Dictionary:
	return _by_id.get(id, {})


func ids() -> Array:
	return _by_id.keys()


## Returns a list of human-readable problems with a boss definition (empty = valid).
func validate(b: Dictionary) -> Array:
	var problems: Array = []
	for key in ["id", "name", "title", "arena", "stats", "appearance", "phases", "attacks"]:
		if not b.has(key):
			problems.append("%s: missing '%s'" % [b.get("id", "?"), key])
	if not problems.is_empty():
		return problems
	var attacks: Dictionary = b["attacks"]
	for aid in attacks:
		var a: Dictionary = attacks[aid]
		if not ATTACK_TYPES.has(a.get("type", "")):
			problems.append("%s.%s: unknown type '%s'" % [b.id, aid, a.get("type", "")])
		if a.get("type", "") == "combo":
			for step in a.get("params", {}).get("sequence", []):
				if not attacks.has(step):
					problems.append("%s.%s: combo step '%s' missing" % [b.id, aid, step])
		if a.has("follow") and not attacks.has(a["follow"]):
			problems.append("%s.%s: follow-up '%s' missing" % [b.id, aid, a["follow"]])
	var last := 2.0
	for p in b["phases"]:
		if float(p.get("threshold", 0)) >= last:
			problems.append("%s: phase thresholds must descend" % b.id)
		last = float(p.get("threshold", 0))
		for aid in p.get("attacks", []):
			if not attacks.has(aid):
				problems.append("%s: phase '%s' references missing attack '%s'" % [b.id, p.get("name", "?"), aid])
	return problems
