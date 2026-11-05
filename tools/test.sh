#!/usr/bin/env bash
# Runs the Godot headless test suite + backend tests. Fails on any script error.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GODOT="${GODOT:-godot}"
cd "$ROOT/game"
"$GODOT" --headless --import >/dev/null 2>&1
LOG="$(mktemp)"
"$GODOT" --headless --fixed-fps 240 res://tests/test_runner.tscn -- "$@" 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[0]}
if grep -E "SCRIPT ERROR|Parse Error|Invalid call|Invalid access|Invalid get|Invalid set" "$LOG" >/dev/null; then
  echo "Godot reported script errors"; STATUS=1
fi
cd "$ROOT/backend" && python3 -m unittest discover -s tests -v || STATUS=1
exit $STATUS
