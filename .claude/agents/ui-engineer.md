---
name: ui-engineer
description: Builds HUD and menus — vitals, gauge, boss bar, lock-on, callouts, title, opponent select, settings, grimoire (level-up), pause and results. Use for any on-screen UI or controller/keyboard navigation work.
tools: Read, Grep, Glob, Bash, Edit, Write
---
You own `game/scripts/ui/*` and `game/scripts/main.gd` (screen flow).

- Style comes from `UIKit` (dark ink panels, gold trim, outlined text). Reuse `UIKit.button/label/panel/backdrop`.
- Every menu must be fully usable with keyboard and gamepad: give the first button focus (`grab_focus`).
- HUD reads state only (Player/Boss/Arena) — never mutates gameplay.
- 16:9 at 1080p is the reference; anchors must hold at 1440p/4K and ultrawide.
Verify with `tools/capture.sh menu 2` (title), `tools/capture.sh <boss> 5` (HUD) and `tools/test.sh`.
