"""Request validation. Everything from the client is untrusted, even on localhost."""

from __future__ import annotations

import re

ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")
STAT_KEYS = ("vigor", "endurance", "strength", "anti_magic")
DIFFICULTIES = ("normal", "hard", "captain")


class ValidationError(ValueError):
    pass


def _int(d: dict, key: str, lo: int, hi: int, default: int | None = None) -> int:
    v = d.get(key, default)
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != int(v):
        raise ValidationError(f"'{key}' must be an integer")
    v = int(v)
    if not lo <= v <= hi:
        raise ValidationError(f"'{key}' out of range [{lo}, {hi}]")
    return v


def validate_profile(p) -> dict:
    if not isinstance(p, dict):
        raise ValidationError("profile must be an object")
    out = {
        "version": _int(p, "version", 1, 100, 1),
        "name": str(p.get("name", "Asta"))[:32],
        "level": _int(p, "level", 1, 999),
        "xp": _int(p, "xp", 0, 10_000_000),
        "unspent": _int(p, "unspent", 0, 2000, 0),
    }
    stats = p.get("stats")
    if not isinstance(stats, dict):
        raise ValidationError("'stats' must be an object")
    out["stats"] = {k: _int(stats, k, 1, 99) for k in STAT_KEYS}
    records = p.get("records", {})
    if not isinstance(records, dict) or len(records) > 200:
        raise ValidationError("'records' must be an object")
    clean = {}
    for boss_id, rec in records.items():
        if not ID_RE.match(str(boss_id)) or not isinstance(rec, dict):
            raise ValidationError("invalid record entry")
        best = rec.get("best_time", 0.0)
        if isinstance(best, bool) or not isinstance(best, (int, float)) or best < 0:
            raise ValidationError("invalid best_time")
        clean[str(boss_id)] = {
            "attempts": _int(rec, "attempts", 0, 1_000_000, 0),
            "wins": _int(rec, "wins", 0, 1_000_000, 0),
            "best_time": float(best),
        }
    out["records"] = clean
    return out


def validate_fight(f) -> dict:
    if not isinstance(f, dict):
        raise ValidationError("fight must be an object")
    for key in ("profile_id", "boss_id"):
        if not isinstance(f.get(key), str) or not ID_RE.match(f[key]):
            raise ValidationError(f"invalid '{key}'")
    if not isinstance(f.get("won"), bool):
        raise ValidationError("'won' must be a boolean")
    t = f.get("time_seconds")
    if isinstance(t, bool) or not isinstance(t, (int, float)) or not 0 < t < 86_400:
        raise ValidationError("'time_seconds' must be a positive number")
    diff = f.get("difficulty", "normal")
    if diff not in DIFFICULTIES:
        raise ValidationError("unknown difficulty")
    return {
        "profile_id": f["profile_id"], "boss_id": f["boss_id"], "won": f["won"],
        "time_seconds": float(t), "difficulty": diff, "level": _int(f, "level", 1, 999, 1),
        "parries": _int(f, "parries", 0, 100_000, 0), "damage_taken": _int(f, "damage_taken", 0, 100_000_000, 0),
    }
