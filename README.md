# Boost Arena

A car-soccer free play mode built from scratch for phones. It runs in the browser using WebGL, with a fixed 120 Hz physics tick and a frame rate tied to your display (120 Hz on a Galaxy S25 Ultra). It supports a PS5 DualSense, other controllers, a keyboard, or on-screen touch controls.

The physics uses the community-measured Rocket League values: the throttle and steering curves, boost acceleration, jump and dodge impulses, air-control torques, the ball bounce and spin model, and the extra impulse the ball gets when the car hits it. Every model, texture and sound is procedural, so no game assets are copied.

## Play it on your S25 Ultra

1. In this repo, go to **Settings → Pages**. Set **Source** to *Deploy from a branch*, pick this branch and `/ (root)`, then save. (GitHub Pages needs a public repo on the free plan.)
2. Open the Pages URL in Chrome on your phone.
3. In the Chrome menu, tap **Add to Home screen**. The game then launches fullscreen in landscape and works offline.
4. Pair the DualSense: hold **Create + PS** until the light bar flashes, then pick it in Android Bluetooth settings. Press any button in the game and the start screen shows *Controller connected · DualSense*.

For 120 fps, set **Settings → Display → Motion smoothness** to *Adaptive* and turn off power saving.

## Default controls (PS5)

| Action | Button |
| --- | --- |
| Throttle / Reverse | R2 / L2 |
| Jump, double jump, dodge | ✕ |
| Boost | ○ |
| Powerslide / Air roll | □ |
| Ball cam (toggle) | △ |
| Look around | Right stick |
| Reset shot | Create |
| Pause | Options |

You can rebind everything under **Settings → Bindings**, including Air Roll Left/Right. Menus work with the controller: D-pad or left stick to move, ✕ to select, ○ to go back, L1/R1 to switch tabs.

## Settings

- **Camera:** FOV, distance, height, angle, stiffness, swivel speed, transition speed, ball cam toggle or hold, invert swivel, camera shake. The defaults match Rocket League's (110 / 270 / 100 / −4 / 0.45 / 5 / 1.2).
- **Controller:** deadzone shape (cross or circle), controller deadzone, dodge deadzone, steering sensitivity, aerial sensitivity, vibration, and a live stick preview that shows raw versus in-game input.
- **Video:** render quality, including an *Auto* mode that lowers resolution to hold the frame rate; frame rate limit; particle detail; FPS counter.
- **Free Play:** unlimited boost, game speed (slow motion), speedometer, spawn location.

## Development

No build step is needed. Serve the folder and open it:

```sh
python3 -m http.server 8000
```

Run the physics checks against the reference numbers (top speeds, jump heights, flip impulse, wall driving, ball restitution, goals):

```sh
node tests/physics.test.mjs
```

| File | What it does |
| --- | --- |
| `js/constants.js` | Physics constants, boost pad layout, spawns |
| `js/arena.js` | Arena collision as a signed distance field (rounded octagon plus goals) |
| `js/physics.js` | Car, ball and boost pads, stepped at 120 Hz |
| `js/camera.js` | Chase camera, ball cam, swivel |
| `js/input.js` | Gamepad, keyboard and touch input, deadzones, rebinding |
| `js/scene.js`, `js/carModel.js`, `js/textures.js`, `js/effects.js` | Rendering |
| `js/ui.js`, `js/settings.js` | HUD, menus, saved settings |
| `js/audio.js` | Synthesized sound |
