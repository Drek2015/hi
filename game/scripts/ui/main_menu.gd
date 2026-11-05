extends Control
## Title screen.

signal fight
signal grimoire
signal settings
signal quit

var _status: Label
var _profile: Label


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	UIKit.backdrop(self)
	var embers := Control.new()
	add_child(embers)
	var col := VBoxContainer.new()
	col.position = Vector2(140, 220)
	col.add_theme_constant_override("separation", 14)
	add_child(col)
	col.add_child(UIKit.label("A BLACK CLOVER FAN GAME", 20, UIKit.DIM, 3))
	col.add_child(UIKit.label("ANTI-MAGIC", 120, UIKit.TEXT, 12))
	col.add_child(UIKit.label("L I M I T   B R E A K E R", 34, UIKit.RED, 6))
	var sp := Control.new()
	sp.custom_minimum_size = Vector2(0, 50)
	col.add_child(sp)
	var first := UIKit.button("Fight", func(): fight.emit(), 28, 380)
	col.add_child(first)
	col.add_child(UIKit.button("Grimoire  (Level Up)", func(): grimoire.emit(), 28, 380))
	col.add_child(UIKit.button("Settings", func(): settings.emit(), 28, 380))
	col.add_child(UIKit.button("Quit", func(): quit.emit(), 28, 380))
	_profile = UIKit.label("", 20, UIKit.GOLD)
	_profile.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_profile.position = Vector2(140, -90)
	add_child(_profile)
	_status = UIKit.label("", 16, UIKit.DIM, 3)
	_status.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_status.position = Vector2(-520, -60)
	_status.custom_minimum_size = Vector2(480, 0)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_status)
	var note := UIKit.label("Personal, non-commercial fan project. Black Clover © Yūki Tabata / Shueisha.", 13, Color(UIKit.DIM, 0.7), 2)
	note.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	note.position = Vector2(-620, -34)
	note.custom_minimum_size = Vector2(580, 0)
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(note)
	Backend.status_changed.connect(func(_o): _refresh())
	GameState.profile_changed.connect(_refresh)
	_refresh()
	first.grab_focus()


func _refresh() -> void:
	var p := GameState.profile
	var wins := 0
	for k in p["records"]:
		wins += 1 if int(p["records"][k].get("wins", 0)) > 0 else 0
	_profile.text = "Asta  ·  Level %d  ·  %d / %d foes defeated%s" % [int(p["level"]), wins, Roster.bosses.size(),
		("  ·  %d stat points to spend" % int(p["unspent"])) if int(p["unspent"]) > 0 else ""]
	_status.text = "Backend: online (%s)" % Settings.backend_url if Backend.online else "Backend: offline — saving locally"
