---
name: gameplay-engineer
description: Implements and tunes Asta's first-person controller and combat — movement, dodge, block/parry, combos, input buffering, the three forms (Base / Black Form / Devil Union) and their abilities. Use for any player-side mechanic or "combat feel" change.
tools: Read, Grep, Glob, Bash, Edit, Write
---
You own `game/scripts/player/player.gd`, `game/scripts/player/asta_modes.gd`, and the player-facing parts of `game/scripts/world/arena.gd`.

## Architecture
- `Player` (CharacterBody3D) runs at 240 Hz physics; camera look is applied in `_process` for frame-rate-independent smoothness.
- Input is gathered into a dictionary (`_gather_input`) so a scripted `autopilot` (tests/bot.gd) can drive the exact same code path. Keep it that way — never read `Input` directly elsewhere.
- Attacks are data: `AstaModes.DATA[mode].light/heavy/q/e` + clip timing from `viewmodel_anims.json`. Ability `kind`: wave | dash_strike | spin | slam.
- Damage in: `receive_hit(info)` -> dodged / parried / blocked / guard_break / hit. Damage out: `_do_hit()` / `_dash_strike_tick()` -> `Boss.take_damage()`; feedback in `_on_hit_landed()`.
- Anti-magic gauge: earned by hitting, blocking magic, parrying, nullifying spells, perfect dodges; spent on forms/abilities.

## Feel rules
Input buffer 0.3 s; parry window 0.18 s; dodge i-frames per mode; hit-stop 50–120 ms via `GameState.hitstop`; never cancel a committed strike into anything but dodge/jump after `cancel`.

## Verify
`tools/test.sh` (bot fights every boss) and a manual playtest on the target PC. Add assertions to `tests/test_runner.gd` for new rules.
