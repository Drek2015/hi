import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import make_server  # noqa: E402
from store import Store  # noqa: E402

PROFILE = {
    "version": 1, "name": "Asta", "level": 3, "xp": 120.0, "unspent": 2,
    "stats": {"vigor": 12, "endurance": 10.0, "strength": 11, "anti_magic": 10},
    "records": {"yuno": {"attempts": 2, "wins": 1, "best_time": 95.5}},
}


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.store = Store(":memory:")
        self.srv = make_server("127.0.0.1", 0, self.store)
        self.base = "http://127.0.0.1:%d" % self.srv.server_address[1]
        self.t = threading.Thread(target=self.srv.serve_forever, daemon=True)
        self.t.start()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        self.store.close()

    def req(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        r = urllib.request.Request(self.base + path, data=data, method=method, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(r, timeout=5) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def fight(self, **kw):
        f = {"profile_id": "default", "boss_id": "yuno", "won": True, "time_seconds": 100.0, "difficulty": "normal", "level": 3}
        f.update(kw)
        return self.req("POST", "/api/fights", f)

    def test_health(self):
        self.assertEqual(self.req("GET", "/api/health"), (200, {"status": "ok", "version": "1.0.0"}))

    def test_roster_lists_all_bosses(self):
        code, body = self.req("GET", "/api/roster")
        self.assertEqual(code, 200)
        ids = [b["id"] for b in body["bosses"]]
        self.assertIn("yuno", ids)
        self.assertIn("lucifero", ids)
        self.assertGreaterEqual(len(ids), 8)

    def test_profile_roundtrip(self):
        self.assertEqual(self.req("GET", "/api/profile/default")[0], 404)
        self.assertEqual(self.req("PUT", "/api/profile/default", PROFILE)[0], 200)
        code, body = self.req("GET", "/api/profile/default")
        self.assertEqual(code, 200)
        self.assertEqual(body["profile"]["level"], 3)
        self.assertEqual(body["profile"]["stats"]["endurance"], 10)
        self.assertEqual(body["profile"]["records"]["yuno"]["best_time"], 95.5)

    def test_profile_validation(self):
        bad = dict(PROFILE, level=-1)
        self.assertEqual(self.req("PUT", "/api/profile/default", bad)[0], 400)
        bad = dict(PROFILE, stats={"vigor": 500, "endurance": 10, "strength": 10, "anti_magic": 10})
        self.assertEqual(self.req("PUT", "/api/profile/default", bad)[0], 400)
        self.assertEqual(self.req("PUT", "/api/profile/bad%20id", PROFILE)[0], 400)
        self.assertEqual(self.req("PUT", "/api/profile/default", ["not", "a", "dict"])[0], 400)

    def test_fights_and_leaderboard(self):
        self.assertEqual(self.fight(time_seconds=120.0)[0], 201)
        self.assertEqual(self.fight(time_seconds=80.0)[0], 201)
        self.assertEqual(self.fight(time_seconds=50.0, won=False)[0], 201)
        self.assertEqual(self.fight(boss_id="zenon", time_seconds=60.0)[0], 201)
        code, body = self.req("GET", "/api/leaderboard/yuno")
        self.assertEqual(code, 200)
        self.assertEqual([e["time_seconds"] for e in body["entries"]], [80.0, 120.0])
        code, body = self.req("GET", "/api/fights?boss_id=yuno&limit=2")
        self.assertEqual(len(body["fights"]), 2)
        code, body = self.req("GET", "/api/stats/default")
        self.assertEqual(body["bosses"]["yuno"], {"attempts": 3, "wins": 2, "best_time": 80.0, "parries": 0})

    def test_fight_validation(self):
        self.assertEqual(self.fight(won="yes")[0], 400)
        self.assertEqual(self.fight(time_seconds=-1)[0], 400)
        self.assertEqual(self.fight(difficulty="impossible")[0], 400)
        self.assertEqual(self.fight(boss_id="../etc")[0], 400)

    def test_unknown_route(self):
        self.assertEqual(self.req("GET", "/api/nope")[0], 404)
        self.assertEqual(self.req("DELETE", "/api/health")[0], 405)


if __name__ == "__main__":
    unittest.main()
