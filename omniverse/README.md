# Omniverse Clash

A 2D platform fighter for Android (built for the Galaxy S25 Ultra at 120 Hz). Fighters use the
pixel art you supplied; fight CPU opponents on Super Easy, Easy, Medium or Hard.

## Install on your phone

1. On the phone, open https://github.com/Drek2015/hi/releases/tag/omniverse-latest (signed in to GitHub).
2. Tap **omniverse-clash.apk** to download it, then open the download.
3. If Android asks, allow your browser to install unknown apps, then tap **Install**.

Every push rebuilds the APK and replaces the file on that page; new builds install over the old
one and keep your progress.

## Controls

- **PS5 controller** (pair it in Android Bluetooth settings): left stick move, ✕ jump, □ light,
  △ heavy, ○ / R1 / L1 abilities, R2 ultimate, L2 guard (L2 + flick = dash, L2 + down = charge),
  L3 dash, Options pause. Buttons can be remapped in Controls.
- **Touch**: drag on the left half to move; buttons on the right.

## Project layout

- `web/` — the game (plain JavaScript modules, no build step). `web/index.html` runs in any browser.
- `web/js/sim/` — fixed 120 Hz fight simulation and AI; `web/js/data/` — fighters, skill trees, arenas, sprite mapping.
- `web/assets/sprites/` — fighter sprites extracted from the supplied reference images (`tools/sprites/`).
- `android/` — Capacitor wrapper; `MainActivity` requests the highest refresh rate and immersive landscape.
- `tests/sim.test.mjs` — every matchup × difficulty played headless (`npm test`).

The fighter art is fan art supplied for personal use: keep the repository private and don't distribute the APK.
