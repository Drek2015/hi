extends Node
## Procedurally synthesised sound effects (no audio files needed). Autoloaded as `Sfx`.
## The audio agent can replace any entry with a recorded .wav/.ogg by dropping a file at
## res://assets/audio/<name>.ogg — real files always win over the synth.

const RATE := 22050
const POOL_3D := 20
const POOL_2D := 8

var streams: Dictionary = {}
var _p3: Array[AudioStreamPlayer3D] = []
var _p2: Array[AudioStreamPlayer] = []
var _i3 := 0
var _i2 := 0
var _seed := 12345


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in POOL_3D:
		var p := AudioStreamPlayer3D.new()
		p.unit_size = 12.0
		p.max_db = 6.0
		p.attenuation_filter_cutoff_hz = 9000.0
		add_child(p)
		_p3.append(p)
	for i in POOL_2D:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_p2.append(p)
	_build_all()


func play(name: String, pos: Variant = null, volume_db: float = 0.0, pitch_jitter: float = 0.07) -> void:
	var s: AudioStream = streams.get(name)
	if s == null:
		return
	var pitch := 1.0 + randf_range(-pitch_jitter, pitch_jitter)
	if pos is Vector3:
		var p := _p3[_i3]
		_i3 = (_i3 + 1) % POOL_3D
		p.stream = s
		p.volume_db = volume_db
		p.pitch_scale = pitch
		p.global_position = pos
		p.play()
	else:
		var p := _p2[_i2]
		_i2 = (_i2 + 1) % POOL_2D
		p.stream = s
		p.volume_db = volume_db
		p.pitch_scale = pitch
		p.play()


# ---------------------------------------------------------------- synthesis

func _rand() -> float:
	_seed = (_seed * 1103515245 + 12345) & 0x7fffffff
	return float(_seed) / float(0x3fffffff) - 1.0


func _to_stream(buf: PackedFloat32Array) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(buf.size() * 2)
	var peak := 0.0001
	for v in buf:
		peak = maxf(peak, absf(v))
	var g := 0.9 / peak
	for i in buf.size():
		bytes.encode_s16(i * 2, int(clampf(buf[i] * g, -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	return w


## Filtered noise with a cutoff sweep — swooshes, wind, explosions.
func _noise(dur: float, attack: float, cut_a: float, cut_b: float, curve: float = 2.0) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := 0.0
	var lp2 := 0.0
	for i in n:
		var t := float(i) / n
		var cut := lerpf(cut_a, cut_b, t)
		var a := clampf(cut / RATE * 6.28, 0.0, 1.0)
		lp += (_rand() - lp) * a
		lp2 += (lp - lp2) * a
		var env := (t / attack) if t < attack else pow(1.0 - (t - attack) / (1.0 - attack), curve)
		out[i] = (lp - lp2 * 0.5) * env
	return out


## Sum of decaying partials — metal, chimes, impacts.
func _partials(dur: float, freqs: Array, decay: float, sweep: float = 1.0) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var phases := []
	for f in freqs:
		phases.append(0.0)
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for k in freqs.size():
			var f: float = freqs[k] * lerpf(1.0, sweep, float(i) / n)
			phases[k] += TAU * f / RATE
			v += sin(phases[k]) * exp(-t * decay * (1.0 + k * 0.35)) / (1.0 + k * 0.6)
		out[i] = v
	return out


func _mix(a: PackedFloat32Array, b: PackedFloat32Array, gb: float = 1.0) -> PackedFloat32Array:
	var n := maxi(a.size(), b.size())
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		out[i] = (a[i] if i < a.size() else 0.0) + (b[i] if i < b.size() else 0.0) * gb
	return out


func _drive(a: PackedFloat32Array, amount: float) -> PackedFloat32Array:
	for i in a.size():
		a[i] = tanh(a[i] * amount)
	return a


func _build_all() -> void:
	streams["swing"] = _to_stream(_noise(0.26, 0.35, 600.0, 3800.0))
	streams["swing_heavy"] = _to_stream(_noise(0.42, 0.45, 300.0, 2200.0, 1.5))
	streams["dodge"] = _to_stream(_noise(0.22, 0.2, 1200.0, 500.0))
	streams["hit"] = _to_stream(_drive(_mix(_partials(0.28, [95.0, 61.0], 14.0, 0.5), _noise(0.12, 0.02, 5000.0, 900.0), 0.9), 2.5))
	streams["hit_heavy"] = _to_stream(_drive(_mix(_partials(0.55, [70.0, 44.0, 120.0], 7.0, 0.45), _noise(0.3, 0.01, 4000.0, 300.0), 1.2), 3.5))
	streams["parry"] = _to_stream(_mix(_partials(0.9, [1250.0, 1873.0, 2654.0, 3911.0, 620.0], 4.5), _noise(0.05, 0.01, 9000.0, 3000.0), 0.6))
	streams["block"] = _to_stream(_mix(_partials(0.35, [410.0, 637.0, 951.0, 180.0], 12.0), _noise(0.08, 0.01, 6000.0, 1000.0), 0.8))
	streams["nullify"] = _to_stream(_mix(_partials(0.5, [220.0, 330.0, 495.0], 6.0, 0.3), _noise(0.4, 0.05, 2500.0, 200.0), 0.7))
	streams["cast"] = _to_stream(_mix(_partials(0.6, [330.0, 495.0, 742.0], 3.0, 2.2), _noise(0.6, 0.5, 2000.0, 6000.0), 0.4))
	streams["explode"] = _to_stream(_drive(_mix(_noise(1.1, 0.02, 1800.0, 120.0, 1.6), _partials(0.9, [55.0, 38.0], 4.0, 0.6), 1.3), 2.0))
	streams["transform"] = _to_stream(_drive(_mix(_partials(1.6, [48.0, 72.0, 96.0], 1.6, 0.7), _noise(1.6, 0.6, 300.0, 5000.0, 1.2), 0.8), 3.0))
	streams["teleport"] = _to_stream(_mix(_partials(0.35, [900.0, 1400.0], 9.0, 0.25), _noise(0.3, 0.1, 7000.0, 1500.0), 0.5))
	streams["beam"] = _to_stream(_drive(_mix(_partials(1.4, [110.0, 165.0, 220.0, 331.0], 0.9), _noise(1.4, 0.15, 1500.0, 2500.0, 0.8), 0.9), 2.0))
	streams["hurt"] = _to_stream(_drive(_mix(_partials(0.3, [140.0, 90.0], 10.0, 0.6), _noise(0.18, 0.02, 3000.0, 600.0), 0.8), 3.0))
	streams["heal"] = _to_stream(_partials(1.2, [523.25, 659.25, 783.99, 1046.5], 2.2))
	streams["ui_move"] = _to_stream(_partials(0.07, [1400.0], 40.0))
	streams["ui_select"] = _to_stream(_partials(0.25, [660.0, 990.0, 1320.0], 12.0))
	streams["victory"] = _to_stream(_partials(3.0, [261.6, 329.6, 392.0, 523.2, 659.2], 0.8))
	streams["defeat"] = _to_stream(_mix(_partials(3.0, [110.0, 103.8, 82.4], 0.9, 0.8), _noise(3.0, 0.2, 400.0, 100.0, 1.0), 0.5))
	streams["step"] = _to_stream(_noise(0.08, 0.05, 900.0, 300.0, 3.0))
	for name in streams.keys():
		for ext in ["ogg", "wav"]:
			var path := "res://assets/audio/%s.%s" % [name, ext]
			if ResourceLoader.exists(path):
				streams[name] = load(path)
				break
