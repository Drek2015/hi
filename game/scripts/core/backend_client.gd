extends Node
## Client for the local game backend (backend/server.py). Autoloaded as `Backend`.
## Every call degrades gracefully: when the server is not running, data is kept in
## user:// so the game is always fully playable offline.

signal status_changed(online: bool)

const LOCAL_PROFILE := "user://profile.json"
const LOCAL_FIGHTS := "user://fights.json"
const PROFILE_ID := "default"

var online := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	check_health()


func check_health() -> bool:
	var res: Variant = await _request(HTTPClient.METHOD_GET, "/api/health")
	return res is Dictionary and res.get("status", "") == "ok"


func load_profile() -> Dictionary:
	var res: Variant = await _request(HTTPClient.METHOD_GET, "/api/profile/" + PROFILE_ID)
	if res is Dictionary and res.get("profile") is Dictionary:
		_write_json(LOCAL_PROFILE, res["profile"])
		return res["profile"]
	var local: Variant = _read_json(LOCAL_PROFILE)
	return local if local is Dictionary else {}


func save_profile(profile: Dictionary) -> void:
	_write_json(LOCAL_PROFILE, profile)
	await _request(HTTPClient.METHOD_PUT, "/api/profile/" + PROFILE_ID, profile)


func post_fight(record: Dictionary) -> void:
	var fights: Variant = _read_json(LOCAL_FIGHTS)
	if not (fights is Array):
		fights = []
	fights.append(record)
	if fights.size() > 500:
		fights = fights.slice(fights.size() - 500)
	_write_json(LOCAL_FIGHTS, fights)
	var body := record.duplicate()
	body["profile_id"] = PROFILE_ID
	await _request(HTTPClient.METHOD_POST, "/api/fights", body)


## Best victories for a boss, fastest first. Falls back to local history.
func get_leaderboard(boss_id: String) -> Array:
	var res: Variant = await _request(HTTPClient.METHOD_GET, "/api/leaderboard/" + boss_id.uri_encode())
	if res is Dictionary and res.get("entries") is Array:
		return res["entries"]
	var fights: Variant = _read_json(LOCAL_FIGHTS)
	var wins: Array = []
	if fights is Array:
		for f in fights:
			if f.get("boss_id") == boss_id and f.get("won", false):
				wins.append({"time_seconds": f.get("time_seconds", 0.0), "difficulty": f.get("difficulty", "normal"), "level": f.get("level", 1)})
	wins.sort_custom(func(a, b): return a["time_seconds"] < b["time_seconds"])
	return wins.slice(0, 10)


# ---------------------------------------------------------------- internals

func _request(method: int, path: String, body: Variant = null) -> Variant:
	var http := HTTPRequest.new()
	http.timeout = 2.5
	add_child(http)
	var headers := PackedStringArray(["Content-Type: application/json", "Accept: application/json"])
	var payload := "" if body == null else JSON.stringify(body)
	if http.request(Settings.backend_url + path, headers, method, payload) != OK:
		http.queue_free()
		_set_online(false)
		return null
	var res: Array = await http.request_completed
	http.queue_free()
	var result: int = res[0]
	var code: int = res[1]
	var raw: PackedByteArray = res[3]
	if result != HTTPRequest.RESULT_SUCCESS:
		_set_online(false)
		return null
	_set_online(true)
	if code < 200 or code >= 300:
		return null
	return JSON.parse_string(raw.get_string_from_utf8())


func _set_online(v: bool) -> void:
	if v != online:
		online = v
		status_changed.emit(v)


func _read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var f := FileAccess.open(path, FileAccess.READ)
	return JSON.parse_string(f.get_as_text()) if f else null


func _write_json(path: String, data: Variant) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data, "\t"))
