#!/usr/bin/env python3
"""Package a Godot web export for hosting where single files must stay small (claude.ai artifacts:
<=15 MB per binary file). Splits index.wasm / index.pck into chunks and writes a play page whose
loader stitches them back together in the browser before Godot boots.

    python3 tools/web/package_web.py export/web dist/web
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

CHUNK = 12 * 1024 * 1024


def split(src: Path, out: Path) -> list[str]:
    data = src.read_bytes()
    names = []
    for i in range(0, len(data), CHUNK):
        name = f"{src.stem}.{src.suffix[1:]}{i // CHUNK:02d}.wasm"  # .wasm: a type artifact hosting serves
        (out / name).write_bytes(data[i:i + CHUNK])
        names.append(name)
    return names


def main() -> int:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    html = (src / "index.html").read_text()
    m = re.search(r"const GODOT_CONFIG = (\{.*?\});", html, re.S)
    config = json.loads(m.group(1)) if m else {"executable": "index", "mainPack": "index.pck"}
    config["canvasResizePolicy"] = 2
    config["ensureCrossOriginIsolationHeaders"] = False
    config["serviceWorker"] = ""
    chunks = {}
    for name in ("index.wasm", "index.pck"):
        chunks[name] = split(src / name, out)
    for f in src.iterdir():
        if f.suffix == ".js" and f.name != "index.service.worker.js":
            (out / f.name).write_bytes(f.read_bytes())
    total = sum((src / n).stat().st_size for n in chunks)
    page = PAGE.replace("__MB__", str(round(total / 1e6))).replace("__CONFIG__", json.dumps(config)).replace("__CHUNKS__", json.dumps(chunks)).replace("__TOTAL__", str(total))
    (out / "play.html").write_text(page)
    files = sorted(p.name for p in out.iterdir() if p.name != "play.html")
    (out / "files.json").write_text(json.dumps(files, indent=1))
    print(f"{len(files)} files, {total / 1e6:.1f} MB game data")
    return 0


PAGE = r"""<title>Anti-Magic Mobile</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
/* Single dark look on purpose: it is a game screen. Full-bleed canvas; start card centred. */
:root { --bg: #07080a; --ink: #ece8df; --muted: #9d968a; --gold: #d9b45a; --red: #b3211f; color-scheme: dark;
  --display: "Cinzel", "Trajan Pro", Georgia, serif; --body: "Atkinson Hyperlegible", system-ui, sans-serif; }
html, body { height: 100%; }
[hidden] { display: none !important; }
body { background: var(--bg); color: var(--ink); font: 16px/1.5 var(--body); overflow: hidden; touch-action: none; }
#canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; background: var(--bg); outline: none; }
#start { position: fixed; inset: 0; display: grid; place-items: center; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 24px;
  background: radial-gradient(120% 80% at 50% 110%, rgba(179,33,31,.35), transparent 60%), var(--bg); z-index: 2; }
.card { max-width: 30rem; display: grid; gap: 14px; text-align: center; }
.eyebrow { font-size: .72rem; letter-spacing: .3em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 0; font: 700 clamp(2.2rem, 9vw, 3.6rem)/1 var(--display); letter-spacing: .04em; text-wrap: balance; }
.sub { font: 700 .82rem var(--body); letter-spacing: .5em; color: var(--red); text-transform: uppercase; }
p { margin: 0; color: var(--muted); font-size: .92rem; }
button { font: 700 1.15rem var(--body); color: var(--bg); background: var(--gold); border: 0; border-radius: 999px; padding: 16px 28px; min-height: 56px; cursor: pointer; }
button:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
button[disabled] { opacity: .6; }
.bar { height: 6px; border-radius: 3px; background: #1d1f24; overflow: hidden; }
.bar i { display: block; height: 100%; width: 0; background: var(--gold); transition: width .2s; }
#status { font-variant-numeric: tabular-nums; font-size: .85rem; color: var(--muted); min-height: 1.3em; }
#rotate { position: fixed; inset: 0; display: none; place-items: center; text-align: center; background: var(--bg); z-index: 3; padding: 24px; }
@media (orientation: portrait) and (max-width: 900px) { body.playing #rotate { display: grid; } }
@media (prefers-reduced-motion: reduce) { .bar i { transition: none; } }
</style>

<canvas id="canvas" tabindex="0">Your browser does not support the game canvas.</canvas>
<div id="start"><div class="card">
  <div class="eyebrow">A Black Clover fan game · phone preview</div>
  <h1>ANTI-MAGIC</h1>
  <div class="sub">Limit Breaker</div>
  <p>Turn your phone sideways. Left thumb moves, drag the right side to look, buttons fight. Sound on.</p>
  <button id="play" type="button">Tap to play</button>
  <div class="bar" aria-hidden="true"><i id="fill"></i></div>
  <div id="status" role="status">About __MB__ MB to download the first time.</div>
</div></div>
<div id="rotate"><p style="font-size:1.1rem;color:#ece8df">Rotate your phone to landscape to play.</p></div>

<script>
const GODOT_CONFIG = __CONFIG__;
const CHUNKS = __CHUNKS__;
const TOTAL = __TOTAL__;
const statusEl = document.getElementById("status");
const fill = document.getElementById("fill");
let loaded = 0;
let assembled = 0;
const reveal = () => {
  document.getElementById("start").hidden = true;
  document.body.classList.add("playing");
  document.getElementById("canvas").focus();
};
const show = (t) => { statusEl.textContent = t; };
const progress = () => { fill.style.width = Math.min(100, 100 * loaded / TOTAL).toFixed(1) + "%"; show(`Downloading ${(loaded / 1e6).toFixed(0)} / ${(TOTAL / 1e6).toFixed(0)} MB`); };

// Godot asks for index.wasm / index.pck; serve them stitched together from their published chunks.
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  const name = url.split("?")[0].split("/").pop();
  if (CHUNKS[name]) {
    const parts = [];
    for (const part of CHUNKS[name]) {
      const r = await realFetch(part);
      if (!r.ok) throw new Error("Missing game file " + part);
      const b = await r.blob();
      loaded += b.size; progress();
      parts.push(b);
    }
    const type = name.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
    const blob = new Blob(parts, { type });
    // Godot's own "started" promise can lag far behind the first frame; show the canvas once both files are in.
    if (++assembled === Object.keys(CHUNKS).length) { show("Starting…"); setTimeout(reveal, 2500); }
    return new Response(blob, { status: 200, headers: { "Content-Type": type, "Content-Length": String(blob.size) } });
  }
  return realFetch(input, init);
};
</script>
<script src="index.js"></script>
<script>
document.getElementById("play").addEventListener("click", async (e) => {
  const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Loading…";
  try { await document.documentElement.requestFullscreen?.(); } catch (_) {}
  try { await screen.orientation?.lock?.("landscape"); } catch (_) {}
  try { await navigator.wakeLock?.request?.("screen"); } catch (_) {}
  progress();
  // Deep link: #boss-yuno jumps straight into that fight.
  const m = location.hash.match(/^#boss-([a-z]+)$/);
  if (m) GODOT_CONFIG.args = ["--", "--boss=" + m[1], "--touch"];
  const engine = new Engine(GODOT_CONFIG);
  engine.startGame({ onProgress: () => {} }).then(reveal, (err) => {
    btn.disabled = false; btn.textContent = "Try again";
    show("Couldn't start: " + (err && err.message ? err.message : err));
  });
});
</script>
"""

if __name__ == "__main__":
    PAGE = PAGE  # noqa: PLW0127
    sys.exit(main())
