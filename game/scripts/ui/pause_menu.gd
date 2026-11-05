extends CanvasLayer
## Pause overlay (runs while the tree is paused).

signal resume
signal restart
signal quit

var _root: Control
var _settings: Control


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_root)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	center.add_child(box)
	var t := UIKit.label("PAUSED", 56, UIKit.GOLD, 8)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(t)
	box.add_child(UIKit.button("Resume", func(): resume.emit()))
	box.add_child(UIKit.button("Restart Fight", func(): restart.emit()))
	box.add_child(UIKit.button("Settings", _open_settings))
	box.add_child(UIKit.button("Leave Fight", func(): quit.emit()))
	visible = false


func set_open(v: bool) -> void:
	visible = v
	if v:
		(_root.find_children("*", "Button", true, false)[0] as Button).grab_focus()
	elif _settings:
		_settings.queue_free()
		_settings = null


func _open_settings() -> void:
	_settings = load("res://scripts/ui/settings_menu.gd").new()
	_settings.connect("back", func(): _settings.queue_free(); _settings = null)
	_root.add_child(_settings)


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("pause"):
		if _settings:
			_settings.queue_free()
			_settings = null
		else:
			resume.emit()
		get_viewport().set_input_as_handled()
