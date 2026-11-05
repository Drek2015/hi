"""SQLite persistence for the game backend (profiles, fight history, leaderboards)."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS profiles (
    id          TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    updated_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS fights (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id    TEXT NOT NULL,
    boss_id       TEXT NOT NULL,
    won           INTEGER NOT NULL,
    time_seconds  REAL NOT NULL,
    difficulty    TEXT NOT NULL,
    level         INTEGER NOT NULL,
    parries       INTEGER NOT NULL DEFAULT 0,
    damage_taken  INTEGER NOT NULL DEFAULT 0,
    created_at    REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS fights_boss ON fights (boss_id, won, time_seconds);
CREATE INDEX IF NOT EXISTS fights_profile ON fights (profile_id, created_at);
"""


class Store:
    """Thread-safe wrapper around a single SQLite connection."""

    def __init__(self, path: str | Path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(self.path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._db.executescript(SCHEMA)
            self._db.commit()

    def close(self) -> None:
        with self._lock:
            self._db.close()

    # -- profiles -------------------------------------------------------
    def get_profile(self, profile_id: str) -> dict | None:
        with self._lock:
            row = self._db.execute("SELECT data FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        return json.loads(row["data"]) if row else None

    def put_profile(self, profile_id: str, data: dict) -> None:
        blob = json.dumps(data, separators=(",", ":"))
        with self._lock:
            self._db.execute(
                "INSERT INTO profiles (id, data, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
                (profile_id, blob, time.time()),
            )
            self._db.commit()

    # -- fights ---------------------------------------------------------
    def add_fight(self, f: dict) -> int:
        with self._lock:
            cur = self._db.execute(
                "INSERT INTO fights (profile_id, boss_id, won, time_seconds, difficulty, level, parries, damage_taken, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (f["profile_id"], f["boss_id"], int(f["won"]), f["time_seconds"], f["difficulty"], f["level"],
                 f.get("parries", 0), f.get("damage_taken", 0), time.time()),
            )
            self._db.commit()
            return int(cur.lastrowid)

    def list_fights(self, profile_id: str | None = None, boss_id: str | None = None, limit: int = 50) -> list[dict]:
        sql = "SELECT * FROM fights WHERE 1=1"
        args: list = []
        if profile_id:
            sql += " AND profile_id = ?"
            args.append(profile_id)
        if boss_id:
            sql += " AND boss_id = ?"
            args.append(boss_id)
        sql += " ORDER BY created_at DESC, id DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [_fight_row(r) for r in rows]

    def leaderboard(self, boss_id: str, limit: int = 10) -> list[dict]:
        with self._lock:
            rows = self._db.execute(
                "SELECT * FROM fights WHERE boss_id = ? AND won = 1 ORDER BY time_seconds ASC, id ASC LIMIT ?",
                (boss_id, limit),
            ).fetchall()
        return [_fight_row(r) for r in rows]

    def stats(self, profile_id: str) -> dict:
        with self._lock:
            rows = self._db.execute(
                "SELECT boss_id, COUNT(*) AS attempts, SUM(won) AS wins, "
                "MIN(CASE WHEN won = 1 THEN time_seconds END) AS best_time, SUM(parries) AS parries "
                "FROM fights WHERE profile_id = ? GROUP BY boss_id ORDER BY boss_id",
                (profile_id,),
            ).fetchall()
        return {
            r["boss_id"]: {
                "attempts": r["attempts"], "wins": r["wins"] or 0,
                "best_time": r["best_time"], "parries": r["parries"] or 0,
            }
            for r in rows
        }


def _fight_row(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["won"] = bool(d["won"])
    return d
