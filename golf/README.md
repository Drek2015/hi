# Putt Legends

Mini golf in six hero-themed worlds, in the style of Golf Battle. It runs in the phone browser with WebGL, real-time shadows and a 120 Hz physics step.

## Worlds

| World | Vibe | Holes |
| --- | --- | --- |
| Shadow City: Rooftops | Gothic night skyline, rain, searchlights, gargoyles | First Night, Gargoyle Ledge, Searchlight Sweep |
| Shadow City: Docks | Neon, fog, cranes, oil slicks | Oil Slick, Crane Yard, Down the Gangway |
| Hall of Heroes | Marble-and-gold HQ in orbit above Earth | The Round Table, Teleporter Bay, Security Doors |
| Titan Tower Island | T-shaped tower on an island at sunset | Big T, Roof Access, Shoreline Zigzag |
| Armor Lab | Red-and-gold armor workshop, holograms | Repulsor Test, Laser Grid, Suit-Up Teleport |
| Haunted Hollow | Halloween: pumpkins, graves, full moon, bats | Graveyard Shift, Reaper's Path, Mansion Steps |

Holes use ramps, spinners, moving blocks, bumpers, boost pads, teleporters, ice and cobweb zones.

## Modes

- **Race Rivals:** you and 3 AI rivals play the same hole at the same time as ghost balls. First in the cup scores the most points (10 / 7 / 5 / 3). There is a 75-second limit per hole, and unfinished balls take +2 strokes.
- **Practice:** solo stroke play against par.

Each world awards up to 3 stars, saved on the device.

## Controls

- **Touch:** drag back from anywhere and release. The dotted line previews the real path, including bounces. 👁 shows the whole hole.
- **Controller (DualSense):** left stick aims (hold L1/R1 for fine aim), hold ✕ to charge power and release to shoot, △ for the overview, Options to pause. The D-pad and ✕/○ work in menus.

## Development

Serve the repository root and open `/golf/`:

```sh
python3 -m http.server 8000
```

Check that every hole is playable and near par (a bot plays each hole three times):

```sh
node golf/tests/sim.test.mjs
```

| File | What it does |
| --- | --- |
| `js/courses.js` | The 18 hole layouts (grid, levels, obstacles, par) |
| `js/sim.js` | Course geometry, ball physics, distance-to-cup field, AI shot planner |
| `js/botworker.js` | Runs the AI planner in a background thread |
| `js/render.js` | Builds the 3D hole: turf, rails, cup, flag, obstacles |
| `js/themes.js` | Per-world look and the surrounding scenery |
| `js/main.js` | Game flow, camera, controls, HUD, results |
| `js/audio.js` | Synthesized sound effects |
