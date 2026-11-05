# Design — Anti-Magic: Limit Breaker

## Pillars
1. **You are Asta.** First person, a sword bigger than you, no magic of your own. Anti-magic is your answer to everything.
2. **Elden Ring-style boss duels.** Readable telegraphs, punishable recoveries, stamina, i-frames and a parry that pays off. Every death should feel fair.
3. **Choose your opponent.** Any boss, any order, three difficulties. RPG growth makes hard fights winnable through practice *or* levels.
4. **High-refresh feel.** 240 Hz physics, uncapped/240 FPS render, low-latency input and nothing that hitches.

## Core loop
Title → **Opponent select** (record, leaderboard, difficulty) → **Fight** → **Results** (XP, level-ups) → **Grimoire** (spend stat points) → repeat.

## Asta's combat
| Resource | Rules |
|---|---|
| HP | 500 + 30 × Vigor. 4 Healing Flower charges per fight (40 % each, 0.9 s, slowed movement). |
| Stamina | 70 + 3 × Endurance. Attacks, dodges, sprint and blocking spend it; regen after a short delay. Empty while blocking = guard break. |
| Anti-magic gauge (0–100) | Earned by landing hits, blocking magic (+8), perfect parries (+18), nullifying spells, perfect dodges (+4). Spent on forms and abilities. |

**Defence.** Dodge has form-dependent i-frames (0.24–0.30 s). Block works against frontal attacks; magic chip damage is zero (the sword eats spells), physical chip is 12 %. **Perfect parry** (block pressed ≤ 0.18 s before impact) negates the hit, reflects projectiles at 1.5× damage, and deals 40 % of max poise to melee attackers.

**Offence.** Light combos are 3–4 hits per form with lunge-to-target while locked on. Heavy attacks deal big poise damage. Sword swings **nullify any spell in their arc**. Breaking the boss's poise staggers them for 2.4 s and opens 1.6× critical damage.

**Forms**
| | Base | Black Form | Devil Union |
|---|---|---|---|
| Enter | free | ≥ 25 % gauge (costs 10) | 100 % gauge |
| Drain | – | 3.5 / s | 6.5 / s |
| Damage / speed / attack speed | 1.0 / 1.0 / 1.0 | 1.25 / 1.3 / 1.35 | 1.8 / 1.45 / 1.5 |
| Special | – | Black Meteorite dash, double jump, air dash | dual swords, hyper armor, 30 % damage reduction |
| Q | Demon-Dweller Slash (wave) | Black Divider (3 waves) | Demon-Destroyer Rush (16 m dash strike) |
| E | Bull Thrust (dash strike) | Black Hurricane (4-hit spin) | Black Clover Slash (9 m slam, clears spells) |

Transforming grants 0.6 s invulnerability and clears nearby spells. When the gauge runs out you drop back to Base.

## Bosses (season 2 / Spade Kingdom arc + Black Bull duels)
| Boss | Element | Phases | Signature threats |
|---|---|---|---|
| Yuno | Wind → Star | 2 | Gale blade fans, Spirit Dive flanks, Spirit Storm beam, star constellations; hovers in phase 2 |
| Noelle Silva | Water | 2 | Valkyrie lance combos, Sea Dragon's Roar, Nest eruptions |
| Yami Sukehiro | Dark | 2 | Heavy katana strings, cross-map Dimension Slash, Black Moon |
| Nacht Faust | Shadow → devils | 3 | Shadow-step backstabs, Gimodelo charge, Plumede feather storm |
| Zenon Zogratis | Bone → Spatial | 2 | Spike trails, bone volleys, Beelzebub blinks and spatial rends |
| Vanica Zogratis | Blood → Curse | 2 | Crimson spears, blood rain, curse-warding seal carpets, blood moons |
| Dante Zogratis | Body → Gravity | 2 | Long flesh-whips, **regeneration (stagger him to stop it)**, gravity wells |
| Lucifero | Gravity | 3 | Giant fists, Falling Heavens, Singularity Ray, Apocalypse combo |

Difficulty multiplies boss HP / damage / speed: Magic Knight 1.0/1.0/1.0 · Vice Captain 1.25/1.35/1.08 · Captain 1.5/1.7/1.16.

## Progression
XP to next level = 300 × level^1.35. First victory over a boss gives 1.6× its XP; losses give XP in proportion to the damage you dealt. Each level gives 2 stat points (cap 60 per stat).

## Out of scope for this milestone (next steps)
- Open-world hub between fights (Clover Kingdom → Spade Kingdom journey) and story cutscenes.
- Hand-sculpted rigged character meshes and motion-captured animation (the pipeline is ready, see ASSET_PIPELINE.md).
- Voice acting and an original score.
