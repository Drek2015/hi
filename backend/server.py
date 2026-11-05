"""Local game backend: REST API for saves, fight history and leaderboards.

Standard library only (Python 3.10+). Binds to 127.0.0.1 by default — it is a local
companion service for the game, not an internet-facing server.

    python backend/server.py                 # http://127.0.0.1:8765
    python backend/server.py --port 9000 --db path/to/game.db

Endpoints
    GET  /api/health
    GET  /api/roster                         -> boss list (from game/data/roster.json)
    GET  /api/profile/<id>                   -> {"profile": {...}} | 404
    PUT  /api/profile/<id>                   body: profile JSON
    POST /api/fights                         body: fight record
    GET  /api/fights?profile_id=&boss_id=&limit=
    GET  /api/leaderboard/<boss_id>?limit=
    GET  /api/stats/<profile_id>
"""

from __future__ import annotations

import argparse
import json
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from store import Store
from validation import ValidationError, validate_fight, validate_profile

VERSION = "1.0.0"
MAX_BODY = 64 * 1024
ROOT = Path(__file__).resolve().parent
ROSTER_PATH = ROOT.parent / "game" / "data" / "roster.json"
ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def make_handler(store: Store, roster_path: Path = ROSTER_PATH):
    class Handler(BaseHTTPRequestHandler):
        server_version = f"AntiMagicBackend/{VERSION}"

        # -- plumbing -----------------------------------------------------
        def log_message(self, fmt, *args):  # quieter default logging
            if getattr(self.server, "verbose", False):
                super().log_message(fmt, *args)

        def _send(self, status: int, payload) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _error(self, status: int, message: str) -> None:
            self._send(status, {"error": message})

        def _body(self):
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0:
                raise ValidationError("request body required")
            if length > MAX_BODY:
                raise ValidationError("request body too large")
            try:
                return json.loads(self.rfile.read(length).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as e:
                raise ValidationError(f"invalid JSON: {e}") from e

        def _route(self):
            url = urlparse(self.path)
            parts = [unquote(p) for p in url.path.strip("/").split("/") if p]
            return parts, parse_qs(url.query)

        @staticmethod
        def _valid_id(value: str) -> bool:
            return bool(ID_RE.match(value))

        # -- verbs --------------------------------------------------------
        def do_GET(self):
            parts, q = self._route()
            if parts == ["api", "health"]:
                return self._send(HTTPStatus.OK, {"status": "ok", "version": VERSION})
            if parts == ["api", "roster"]:
                try:
                    data = json.loads(roster_path.read_text(encoding="utf-8"))
                except OSError:
                    return self._error(HTTPStatus.NOT_FOUND, "roster not found")
                bosses = [
                    {k: b.get(k) for k in ("id", "name", "title", "affiliation", "magic", "arena", "xp")}
                    for b in data.get("bosses", [])
                ]
                return self._send(HTTPStatus.OK, {"bosses": bosses})
            if len(parts) == 3 and parts[:2] == ["api", "profile"]:
                if not self._valid_id(parts[2]):
                    return self._error(HTTPStatus.BAD_REQUEST, "invalid profile id")
                prof = store.get_profile(parts[2])
                if prof is None:
                    return self._error(HTTPStatus.NOT_FOUND, "profile not found")
                return self._send(HTTPStatus.OK, {"profile": prof})
            if parts == ["api", "fights"]:
                pid = q.get("profile_id", [None])[0]
                bid = q.get("boss_id", [None])[0]
                for v in (pid, bid):
                    if v is not None and not self._valid_id(v):
                        return self._error(HTTPStatus.BAD_REQUEST, "invalid id")
                limit = _limit(q)
                return self._send(HTTPStatus.OK, {"fights": store.list_fights(pid, bid, limit)})
            if len(parts) == 3 and parts[:2] == ["api", "leaderboard"]:
                if not self._valid_id(parts[2]):
                    return self._error(HTTPStatus.BAD_REQUEST, "invalid boss id")
                return self._send(HTTPStatus.OK, {"boss_id": parts[2], "entries": store.leaderboard(parts[2], _limit(q, 10))})
            if len(parts) == 3 and parts[:2] == ["api", "stats"]:
                if not self._valid_id(parts[2]):
                    return self._error(HTTPStatus.BAD_REQUEST, "invalid profile id")
                return self._send(HTTPStatus.OK, {"profile_id": parts[2], "bosses": store.stats(parts[2])})
            return self._error(HTTPStatus.NOT_FOUND, "not found")

        def do_PUT(self):
            parts, _ = self._route()
            if len(parts) == 3 and parts[:2] == ["api", "profile"]:
                if not self._valid_id(parts[2]):
                    return self._error(HTTPStatus.BAD_REQUEST, "invalid profile id")
                try:
                    prof = validate_profile(self._body())
                except ValidationError as e:
                    return self._error(HTTPStatus.BAD_REQUEST, str(e))
                store.put_profile(parts[2], prof)
                return self._send(HTTPStatus.OK, {"ok": True})
            return self._error(HTTPStatus.NOT_FOUND, "not found")

        def do_POST(self):
            parts, _ = self._route()
            if parts == ["api", "fights"]:
                try:
                    fight = validate_fight(self._body())
                except ValidationError as e:
                    return self._error(HTTPStatus.BAD_REQUEST, str(e))
                fid = store.add_fight(fight)
                return self._send(HTTPStatus.CREATED, {"id": fid})
            return self._error(HTTPStatus.NOT_FOUND, "not found")

        def do_DELETE(self):
            return self._error(HTTPStatus.METHOD_NOT_ALLOWED, "method not allowed")

        do_PATCH = do_DELETE

    return Handler


def _limit(q: dict, default: int = 50) -> int:
    try:
        return max(1, min(200, int(q.get("limit", [default])[0])))
    except (TypeError, ValueError):
        return default


def make_server(host: str, port: int, store: Store, verbose: bool = False) -> ThreadingHTTPServer:
    srv = ThreadingHTTPServer((host, port), make_handler(store))
    srv.verbose = verbose
    return srv


def main() -> None:
    ap = argparse.ArgumentParser(description="Anti-Magic: Limit Breaker local backend")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--db", default=str(ROOT / "data" / "game.db"))
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()
    store = Store(args.db)
    srv = make_server(args.host, args.port, store, args.verbose)
    print(f"Anti-Magic backend {VERSION} on http://{args.host}:{args.port}  (db: {args.db})")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
        store.close()


if __name__ == "__main__":
    main()
