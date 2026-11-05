# Asset pipeline + agent team

Everything you see and hear is generated from code and data, so agents (and you) can iterate
without binary assets. Every system also has an upgrade path to hand-made assets.

| Asset | Source of truth | Owner agent | Upgrade path |
|---|---|---|---|
| Boss characters | `data/roster.json` → `appearance`, built by `scripts/boss/character_rig.gd` | character-artist | Rigged `.glb` in `assets/characters/<id>/` mapped onto rig joints |
| Asta's arms + swords | `scripts/player/viewmodel.gd`, `shaders/viewmodel.gdshader` | weapon-artist | `.glb` sword/arms parented to `hand_r` / `hand_l` (keep the viewmodel shader) |
| First-person animation | `data/viewmodel_anims.json` | animator | Keep clip timing data; poses can be keyed by hand or from Blender |
| Boss animation | `data/rig_poses.json` + procedural walk/hover | animator | Godot `AnimationPlayer` on imported skeletons; trigger by the same pose names |
| Spells / impacts | `scripts/fx/vfx.gd`, energy/slash/telegraph/trail shaders | vfx-artist | Flipbook textures in `assets/vfx/` |
| Arenas | `scripts/world/arena_builder.gd`, sky/floor/foliage shaders | environment-artist | `.glb` set pieces in `assets/arenas/<theme>/` |
| Sound | `scripts/core/sfx.gd` (synth) | audio-designer | Drop `assets/audio/<name>.ogg`; it overrides the synth automatically |
| Fight design | `data/roster.json` → phases/attacks | boss-designer | — |

## The agents (`.claude/agents/`)
Ask Claude Code for one by name, for example: *"use the boss-designer agent to add Mereoleona as a new boss"*.
For anything spanning several assets, start with **game-director**. It plans the work and delegates to the others.

**Asset agents:** `art-director` · `character-artist` · `weapon-artist` · `animator` · `vfx-artist` · `environment-artist` · `audio-designer`
**Code agents:** `gameplay-engineer` · `boss-designer` · `performance-engineer` · `ui-engineer` · `backend-engineer` · `qa-tester`

Each agent definition lists the files it owns, the rules for its domain, and how to verify its own work
(`tools/test.sh`, `tools/capture.sh`).

## Example: adding a new boss end to end
1. **boss-designer** adds an entry to `roster.json` with stats, phases and attacks, reusing pattern types and a canon move list.
2. **character-artist** writes the `appearance` block and, if needed, adds a hair style, outfit or weapon.
3. **animator** adds any new poses the moveset needs to `rig_poses.json`.
4. **vfx-artist** adds an element to `VFX.ELEMENTS` if the magic type is new.
5. **environment-artist** picks or creates an arena theme.
6. **qa-tester** runs `tools/test.sh --boss=<id>`, which forces every attack in every phase, and `tools/capture.sh <id> "5,9"`.
7. **art-director** reviews the screenshots. **game-director** signs off.

## Licensing rules (non-negotiable)
- This is a personal fan project. Never add official Black Clover art, models, audio, voice clips or logos.
- Third-party assets must be CC0, or carry a licence that allows this use. Record them below.

### Third-party asset log
| File | Source | Licence |
|---|---|---|
| *(none — everything is procedural)* | | |
