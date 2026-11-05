extends Control
## Choose your opponent (any fight, any order) and difficulty.

signal start(boss_id: String)
signal back

var _detail: VBoxContainer
var _selected := ""
var _diff_buttons: Dictionary = {}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	UIKit.backdrop(self)
	var title := UIKit.label("CHOOSE YOUR OPPONENT", 44, UIKit.TEXT, 8)
	title.position = Vector2(100, 60)
	add_child(title)
	var sub := UIKit.label("Season 2 — Spade Kingdom arc, plus Black Bull sparring duels", 18, UIKit.DIM)
	sub.position = Vector2(104, 122)
	add_child(sub)
	var list := VBoxContainer.new()
	list.position = Vector2(100, 180)
	list.add_theme_constant_override("separation", 8)
	add_child(list)
	var first: Button
	for b in Roster.bosses:
		var rec := GameState.record_for(b["id"])
		var mark := "   (defeated)" if int(rec["wins"]) > 0 else ""
		var btn := UIKit.button("%s%s" % [b["name"], mark], _select.bind(b["id"]), 22, 380)
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.focus_entered.connect(_select.bind(b["id"]))
		list.add_child(btn)
		if first == null:
			first = btn
	list.add_child(UIKit.button("Back", func(): back.emit(), 22, 380))
	var panel := UIKit.panel(Vector2(980, 760))
	panel.position = Vector2(560, 180)
	add_child(panel)
	_detail = VBoxContainer.new()
	_detail.add_theme_constant_override("separation", 10)
	panel.add_child(_detail)
	_select(GameState.selected_boss if Roster.get_boss(GameState.selected_boss).size() > 0 else Roster.bosses[0]["id"])
	if first:
		first.grab_focus()


func _select(id: String) -> void:
	if id == _selected:
		return
	_selected = id
	GameState.selected_boss = id
	for c in _detail.get_children():
		c.queue_free()
	var b := Roster.get_boss(id)
	var rec := GameState.record_for(id)
	_detail.add_child(UIKit.label(b["name"].to_upper(), 54, UIKit.TEXT, 8))
	_detail.add_child(UIKit.label(b["title"], 22, UIKit.GOLD))
	_detail.add_child(UIKit.label("%s  ·  %s" % [b.get("affiliation", ""), b.get("magic", "")], 17, UIKit.DIM))
	var desc := UIKit.label(b.get("description", ""), 19, UIKit.TEXT, 2)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(920, 0)
	_detail.add_child(desc)
	var phases: Array = []
	for p in b["phases"]:
		phases.append(p["name"])
	_detail.add_child(UIKit.label("Phases: " + "  →  ".join(phases), 17, UIKit.GOLD, 2))
	_detail.add_child(UIKit.label("Arena: %s" % ArenaBuilder.THEMES.get(b["arena"], {}).get("label", b["arena"]), 17, UIKit.DIM, 2))
	_detail.add_child(UIKit.label("Attempts %d   ·   Victories %d   ·   Best %s" % [int(rec["attempts"]), int(rec["wins"]), UIKit.fmt_time(float(rec["best_time"]))], 18, UIKit.TEXT, 2))
	var lb := UIKit.label("Leaderboard: loading…", 16, UIKit.DIM, 2)
	_detail.add_child(lb)
	_load_board(id, lb)
	var diff_row := HBoxContainer.new()
	diff_row.add_theme_constant_override("separation", 10)
	_diff_buttons.clear()
	for d in Settings.DIFFICULTIES:
		var btn := UIKit.button(Settings.DIFFICULTIES[d]["label"], _set_diff.bind(d), 18, 200)
		btn.toggle_mode = true
		btn.button_pressed = Settings.difficulty == d
		_diff_buttons[d] = btn
		diff_row.add_child(btn)
	_detail.add_child(diff_row)
	_detail.add_child(UIKit.button("BEGIN FIGHT", func(): start.emit(_selected), 30, 920))


func _set_diff(d: String) -> void:
	Settings.difficulty = d
	Settings.save_settings()
	for k in _diff_buttons:
		_diff_buttons[k].button_pressed = k == d


func _load_board(id: String, lb: Label) -> void:
	var entries: Array = await Backend.get_leaderboard(id)
	if not is_instance_valid(lb) or _selected != id:
		return
	if entries.is_empty():
		lb.text = "Leaderboard: no victories yet"
		return
	var parts: Array = []
	for i in mini(entries.size(), 5):
		var e: Dictionary = entries[i]
		parts.append("%d. %s (%s)" % [i + 1, UIKit.fmt_time(float(e.get("time_seconds", 0))), Settings.DIFFICULTIES.get(e.get("difficulty", "normal"), {}).get("label", "?")])
	lb.text = "Fastest: " + "   ".join(parts)
