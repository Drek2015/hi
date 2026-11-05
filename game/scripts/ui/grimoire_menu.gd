extends Control
## RPG progression: spend stat points earned from victories.

signal back

var _col: VBoxContainer


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	UIKit.backdrop(self)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := UIKit.panel(Vector2(860, 0))
	center.add_child(panel)
	_col = VBoxContainer.new()
	_col.add_theme_constant_override("separation", 12)
	panel.add_child(_col)
	GameState.profile_changed.connect(_rebuild)
	_rebuild()


func _rebuild() -> void:
	for c in _col.get_children():
		c.queue_free()
	var p := GameState.profile
	_col.add_child(UIKit.label("GRIMOIRE — ASTA", 40, UIKit.GOLD, 6))
	var lvl := int(p["level"])
	_col.add_child(UIKit.label("Level %d   ·   XP %d / %d   ·   Points to spend: %d" % [lvl, int(p["xp"]), GameState.xp_to_next(lvl), int(p["unspent"])], 20))
	for k in GameState.STAT_KEYS:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 20)
		var name_l := UIKit.label("%s  %d" % [GameState.STAT_LABELS[k], GameState.stat(k)], 24)
		name_l.custom_minimum_size = Vector2(280, 0)
		row.add_child(name_l)
		var help := UIKit.label(GameState.STAT_HELP[k], 17, UIKit.DIM, 2)
		help.custom_minimum_size = Vector2(300, 0)
		row.add_child(help)
		var b := UIKit.button("+", func(): GameState.allocate(k), 22, 70)
		b.disabled = int(p["unspent"]) <= 0
		row.add_child(b)
		_col.add_child(row)
	_col.add_child(UIKit.label("Max HP %d   ·   Stamina %d   ·   Damage ×%.2f   ·   Gauge gain ×%.2f" % [
		int(GameState.max_hp()), int(GameState.max_stamina()), GameState.damage_mult(), GameState.gauge_mult()], 18, UIKit.GOLD, 2))
	var back_b := UIKit.button("Back", func(): back.emit(), 24, 800)
	_col.add_child(back_b)
	back_b.grab_focus.call_deferred()
