#!/usr/bin/env bash
# Render screenshots of a fight (or the menu) to captures/.
#   tools/capture.sh <boss_id|menu> "<t1,t2,...>" [--near] [--fov=38] [--autoplay] [--quality=ultra]
# Headless Linux CI: needs xvfb-run (+ mesa-vulkan-drivers for Forward+). On a desktop it opens a window.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GODOT="${GODOT:-godot}"
BOSS="${1:-yuno}"; TIMES="${2:-5}"; shift $(( $# > 1 ? 2 : $# ))
OUT="$ROOT/captures"; mkdir -p "$OUT"
ARGS=(--capture="$OUT" --capture-at="$TIMES")
[ "$BOSS" != "menu" ] && ARGS+=(--boss="$BOSS")
RUN=("$GODOT" --resolution 1280x720 --windowed --path "$ROOT/game" res://scenes/main.tscn -- "${ARGS[@]}" "$@")
if [ -z "${DISPLAY:-}" ] && command -v xvfb-run >/dev/null; then RUN=(xvfb-run -a -s "-screen 0 1920x1080x24" "${RUN[@]}"); fi
"${RUN[@]}" 2>&1 | grep -E "captured|SCRIPT ERROR" || true
ls -1 "$OUT"
