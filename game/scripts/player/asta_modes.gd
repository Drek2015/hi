class_name AstaModes
## Asta's three forms. Pure data: tune numbers here, not in player.gd.
##  base  — Demon-Slayer sword, steady and heavy.
##  black — Black Form: anti-magic flows through his body. Faster, Black Meteorite dashes. Drains gauge.
##  devil — Devil Union with Liebe: dual swords, air dash, hyper armor. Needs a full gauge, drains fast.

const ORDER := ["base", "black", "devil"]

const DATA := {
	"base": {
		"name": "Base Form", "short": "BASE", "color": Color(0.85, 0.82, 0.75),
		"dmg": 1.0, "move": 1.0, "atk_speed": 1.0, "enter_cost": 0.0, "min_gauge": 0.0, "drain": 0.0,
		"dodge_speed": 13.0, "dodge_time": 0.32, "iframes": 0.24, "dodge_cost": 22.0, "air_dash": false,
		"hyper_armor": false, "damage_taken": 1.0, "jumps": 1,
		"light": [
			{"clip": "slash_r", "dmg": 42.0, "poise": 18.0, "range": 3.1, "arc": 120.0, "lunge": 2.5, "stamina": 12.0},
			{"clip": "slash_l", "dmg": 46.0, "poise": 20.0, "range": 3.1, "arc": 120.0, "lunge": 2.5, "stamina": 12.0},
			{"clip": "overhead", "dmg": 78.0, "poise": 42.0, "range": 3.3, "arc": 60.0, "lunge": 4.0, "stamina": 16.0},
		],
		"heavy": {"clip": "heavy", "dmg": 125.0, "poise": 75.0, "range": 3.5, "arc": 70.0, "lunge": 5.0, "stamina": 30.0},
		"q": {"name": "Demon-Dweller Slash", "clip": "wave_cast", "kind": "wave", "dmg": 90.0, "poise": 30.0,
			"cost": 15.0, "cooldown": 3.0, "speed": 30.0, "radius": 1.5, "count": 1},
		"e": {"name": "Bull Thrust", "clip": "thrust", "kind": "dash_strike", "dmg": 110.0, "poise": 55.0,
			"cost": 10.0, "cooldown": 4.0, "distance": 9.0, "time": 0.28},
	},
	"black": {
		"name": "Black Form", "short": "BLACK ASTA", "color": Color(0.2, 0.2, 0.22),
		"dmg": 1.25, "move": 1.3, "atk_speed": 1.35, "enter_cost": 10.0, "min_gauge": 25.0, "drain": 3.5,
		"dodge_speed": 24.0, "dodge_time": 0.26, "iframes": 0.3, "dodge_cost": 18.0, "air_dash": true,
		"hyper_armor": false, "damage_taken": 1.0, "jumps": 2,
		"light": [
			{"clip": "slash_r", "dmg": 44.0, "poise": 18.0, "range": 3.3, "arc": 130.0, "lunge": 3.5, "stamina": 9.0},
			{"clip": "slash_l", "dmg": 44.0, "poise": 18.0, "range": 3.3, "arc": 130.0, "lunge": 3.5, "stamina": 9.0},
			{"clip": "slash_r", "dmg": 50.0, "poise": 22.0, "range": 3.3, "arc": 130.0, "lunge": 3.5, "stamina": 9.0},
			{"clip": "overhead", "dmg": 85.0, "poise": 45.0, "range": 3.6, "arc": 70.0, "lunge": 5.0, "stamina": 12.0},
		],
		"heavy": {"clip": "heavy", "dmg": 140.0, "poise": 80.0, "range": 3.8, "arc": 80.0, "lunge": 7.0, "stamina": 24.0},
		"q": {"name": "Black Divider", "clip": "wave_cast", "kind": "wave", "dmg": 75.0, "poise": 30.0,
			"cost": 20.0, "cooldown": 4.0, "speed": 38.0, "radius": 2.2, "count": 3},
		"e": {"name": "Black Hurricane", "clip": "spin", "kind": "spin", "dmg": 55.0, "poise": 25.0,
			"cost": 20.0, "cooldown": 6.0, "radius": 6.0, "hits": 4},
	},
	"devil": {
		"name": "Devil Union", "short": "DEVIL UNION", "color": Color(0.75, 0.08, 0.1),
		"dmg": 1.8, "move": 1.45, "atk_speed": 1.5, "enter_cost": 0.0, "min_gauge": 100.0, "drain": 6.5,
		"dodge_speed": 30.0, "dodge_time": 0.22, "iframes": 0.3, "dodge_cost": 14.0, "air_dash": true,
		"hyper_armor": true, "damage_taken": 0.7, "jumps": 2,
		"light": [
			{"clip": "slash_r", "dmg": 48.0, "poise": 22.0, "range": 3.6, "arc": 140.0, "lunge": 4.0, "stamina": 7.0},
			{"clip": "dual_l", "dmg": 48.0, "poise": 22.0, "range": 3.6, "arc": 140.0, "lunge": 4.0, "stamina": 7.0},
			{"clip": "slash_l", "dmg": 52.0, "poise": 24.0, "range": 3.6, "arc": 140.0, "lunge": 4.0, "stamina": 7.0},
			{"clip": "dual_cross", "dmg": 110.0, "poise": 60.0, "range": 3.9, "arc": 100.0, "lunge": 6.0, "stamina": 10.0},
		],
		"heavy": {"clip": "heavy", "dmg": 170.0, "poise": 95.0, "range": 4.2, "arc": 90.0, "lunge": 8.0, "stamina": 20.0},
		"q": {"name": "Demon-Destroyer Rush", "clip": "thrust", "kind": "dash_strike", "dmg": 260.0, "poise": 120.0,
			"cost": 25.0, "cooldown": 5.0, "distance": 16.0, "time": 0.24},
		"e": {"name": "Black Clover Slash", "clip": "slam", "kind": "slam", "dmg": 320.0, "poise": 150.0,
			"cost": 35.0, "cooldown": 9.0, "radius": 9.0},
	},
}


static func get_mode(id: String) -> Dictionary:
	return DATA.get(id, DATA["base"])
