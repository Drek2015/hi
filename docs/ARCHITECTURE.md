# Architecture

```
hi/
├─ game/                      Godot 4.5 project (front end)
│  ├─ project.godot           240 Hz physics (Jolt), Forward+, autoloads
│  ├─ scenes/main.tscn        single entry scene -> scripts/main.gd (screen flow)
│  ├─ scripts/core/           autoloads: Settings, Roster, Backend, GameState, Sfx
│  ├─ scripts/player/         Player (controller + combat), AstaModes (form data), ViewModel (arms/swords/anim)
│  ├─ scripts/boss/           Boss (AI + attack patterns), CharacterRig (procedural model + pose animator),
│  │                          Projectile, Hazard (circle / ring / beam / gravity well)
│  ├─ scripts/world/          Arena (one fight), ArenaBuilder (procedural themed arenas + quality presets)
│  ├─ scripts/fx/vfx.gd       VFX factory + element palette
│  ├─ scripts/ui/             HUD, menus, UIKit styling
│  ├─ shaders/                viewmodel, energy, dark_core, slash, trail, telegraph, floor, sky, foliage, vignette, menu_bg
│  ├─ data/                   roster.json (bosses), viewmodel_anims.json (Asta clips), rig_poses.json (boss poses)
│  └─ tests/                  test_runner (headless suite), bot (scripted Asta)
├─ backend/                   Python stdlib + SQLite REST service (back end)
├─ tools/                     test.sh, capture.sh
├─ .claude/agents/            asset + code subagents
└─ docs/
```

## Runtime flow
`main.gd` swaps screens: MainMenu → BossSelect → **Arena** → ResultScreen (plus Grimoire / Settings).
An `Arena` builds the themed world, spawns `Player` and `Boss`, adds the HUD and pause menu, and owns every
projectile and hazard. Arena results flow to `GameState.record_fight()` (XP, records), which saves through `Backend`.

## Combat data flow
```
Input / autopilot ─▶ Player._gather_input ─▶ state machine (free/attack/dodge/heal/stagger/transform/dead)
                                               │  timings from viewmodel_anims.json (hit/cancel frames)
                                               ▼
                      Player._do_hit ─▶ Boss.take_damage ─▶ poise ▸ stagger │ phase threshold ▸ transition │ death
                      Arena.nullify_projectiles_in_arc (anti-magic)
Boss AI: idle/locomote ─▶ weighted attack choice (range, cooldown, anti-repeat) ─▶ pattern coroutine
         (melee/volley/aoe/ring/beam/teleport/pull/summon/regen/combo) ─▶ Projectile / Hazard ─▶ Player.receive_hit
```
Boss attack coroutines are cancelled with a token: stagger, parry recoil, phase change or death bumps `_token`,
and every `await` checks `_alive(my)`. Waits use child `Timer` nodes, so a freed boss never resumes a coroutine.

Hit detection is analytic (cone checks, sphere-vs-capsule, distance to beam segment). Results are deterministic
at any frame rate and cost no physics queries.

## Rendering
- Characters: `StandardMaterial3D` toon diffuse/specular, rim light, inverted-hull outline pass, emission hit-flash.
- Viewmodel: custom shader that pushes clip depth toward the near plane (reversed-Z), so the sword never clips into geometry.
- Environment: procedural sky shader (no TIME, so the radiance map is cached), AgX tonemapping, glow, fog; SSAO,
  volumetric fog, SDFGI, SSIL and SSR are gated by quality preset.

## Backend API (127.0.0.1:8765)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{status, version}` |
| GET | `/api/roster` | Boss summary from `game/data/roster.json` |
| GET/PUT | `/api/profile/<id>` | Profile JSON is validated (stat ranges, ids, sizes) |
| POST | `/api/fights` | `{profile_id, boss_id, won, time_seconds, difficulty, level, parries, damage_taken}` |
| GET | `/api/fights?profile_id=&boss_id=&limit=` | Newest first |
| GET | `/api/leaderboard/<boss_id>` | Fastest victories |
| GET | `/api/stats/<profile_id>` | Per-boss attempts / wins / best time / parries |

The game client (`Backend` autoload) mirrors everything to `user://profile.json` and `user://fights.json`, so it works offline.

## Testing
`tools/test.sh` runs Godot headless at a fixed 240 FPS, as fast as the CPU allows:
1. validates roster, clips, poses and form data;
2. checks the progression math;
3. for each boss, runs 40 s of bot-vs-boss combat, forces every phase transition and every attack, then kills the boss.
   Any GDScript runtime error fails the run;
4. runs the backend unittest suite.
