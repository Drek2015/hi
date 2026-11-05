extends Control
## Post-fight summary.

signal retry
signal select
signal menu


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	UIKit.backdrop(self)
	var r := GameState.last_result
	var won: bool = r.get("won", false)
	var b := Roster.get_boss(r.get("boss_id", ""))
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	center.add_child(col)
	var title := UIKit.label("LIMIT SURPASSED" if won else "DEFEATED", 96, Color(1.0, 0.85, 0.45) if won else UIKit.RED, 10)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(title)
	var st: Dictionary = r.get("stats", {})
	var lines := [
		"%s — %s" % [b.get("name", "?"), Settings.difficulty_data()["label"]],
		"Time %s   ·   Damage dealt %d   ·   Damage taken %d" % [UIKit.fmt_time(r.get("time_seconds", 0.0)), int(st.get("damage_dealt", 0)), int(st.get("damage_taken", 0))],
		"Perfect parries %d   ·   Spells nullified %d   ·   Dodges %d" % [int(st.get("parries", 0)), int(st.get("nullified", 0)), int(st.get("dodges", 0))],
		"+%d XP%s" % [int(r.get("xp", 0)), ("   ·   LEVEL UP ×%d — spend points in the Grimoire" % int(r["levels"])) if int(r.get("levels", 0)) > 0 else ""],
	]
	if not won:
		lines.insert(1, "Boss health removed: %d%%" % int(float(st.get("boss_damage_pct", 0.0)) * 100.0))
	for l in lines:
		var lab := UIKit.label(l, 22, UIKit.TEXT, 3)
		lab.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(lab)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	var first := UIKit.button("Fight Again", func(): retry.emit(), 22, 260)
	row.add_child(first)
	row.add_child(UIKit.button("Choose Opponent", func(): select.emit(), 22, 260))
	row.add_child(UIKit.button("Main Menu", func(): menu.emit(), 22, 260))
	col.add_child(row)
	first.grab_focus()
