#!/usr/bin/env python3
"""Download the third-party assets listed in game/assets/manifest.json and write CREDITS.md.

    python3 tools/assets/fetch_assets.py                 # everything
    python3 tools/assets/fetch_assets.py --only polyhaven
    python3 tools/assets/fetch_assets.py --only sketchfab

Sources
  * Poly Haven (CC0)  — public API, no key.
  * Direct zips (OpenGameArt: VRoid CC0 anime bodies, Quaternius CC0 animations) — no key.
  * Sketchfab (per-model Creative Commons licence) — needs an API token: either set
    SKETCHFAB_TOKEN, or run where a proxy injects it (Claude Code cloud sessions).
    Models whose licence is not CC0/CC-BY are refused.

Downloaded files are data: archives are extracted with path checks and nothing in them is executed.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "game" / "assets"
MANIFEST = ASSETS / "manifest.json"
CREDITS_JSON = ASSETS / "credits.json"
ALLOWED_LICENSES = {"cc0", "by"}
UA = "AntiMagicAssetFetcher/1.0"


def get(url: str, headers: dict | None = None) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def get_json(url: str, headers: dict | None = None):
    return json.loads(get(url, headers))


def save(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def safe_extract(zf: zipfile.ZipFile, dest: Path) -> None:
    dest = dest.resolve()
    for m in zf.infolist():
        target = (dest / m.filename).resolve()
        if not str(target).startswith(str(dest)):
            raise RuntimeError(f"unsafe path in archive: {m.filename}")
        if m.is_dir():
            continue
        if target.suffix.lower() in {".exe", ".bat", ".sh", ".py", ".dll", ".so", ".js", ".cmd", ".ps1"}:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(zf.read(m))


# ---------------------------------------------------------------- Poly Haven

def polyhaven(cfg: dict, credits: dict) -> None:
    for kind, items in cfg.items():
        for name, res in items.items():
            out = ASSETS / "polyhaven" / kind / name
            files = get_json(f"https://api.polyhaven.com/files/{name}")
            info = get_json(f"https://api.polyhaven.com/info/{name}")
            if kind == "hdris":
                f = files["hdri"][res]["hdr"]
                save(out / f"{name}_{res}.hdr", get(f["url"]))
            elif kind == "textures":
                for key in ("Diffuse", "nor_gl", "Rough", "AO"):
                    if key in files and res in files[key]:
                        f = files[key][res]["jpg"]
                        save(out / Path(f["url"]).name, get(f["url"]))
            elif kind == "models":
                g = files["gltf"][res]["gltf"]
                save(out / Path(g["url"]).name, get(g["url"]))
                for rel, inc in g.get("include", {}).items():
                    save(out / rel, get(inc["url"]))
            authors = ", ".join(info.get("authors", {}).keys())
            credits[f"polyhaven/{kind}/{name}"] = {
                "title": info.get("name", name), "author": authors, "license": "CC0",
                "url": f"https://polyhaven.com/a/{name}", "source": "Poly Haven"}
            print(f"  polyhaven {kind}/{name} ({res})")


# ---------------------------------------------------------------- Sketchfab

def sketchfab(cfg: dict, credits: dict) -> None:
    token = os.environ.get("SKETCHFAB_TOKEN", "proxy-injected")
    auth = {"Authorization": f"Token {token}"}
    for slug, uid in cfg.items():
        meta = get_json(f"https://api.sketchfab.com/v3/models/{uid}")
        lic = (meta.get("license") or {}).get("slug", "")
        if lic not in ALLOWED_LICENSES:
            print(f"  SKIP sketchfab {slug}: licence '{lic}' not allowed")
            continue
        dl = get_json(f"https://api.sketchfab.com/v3/models/{uid}/download", auth)
        out = ASSETS / "sketchfab" / slug
        if "glb" in dl:
            save(out / f"{slug}.glb", get(dl["glb"]["url"]))
        else:
            with zipfile.ZipFile(io.BytesIO(get(dl["gltf"]["url"]))) as zf:
                safe_extract(zf, out)
        user = meta.get("user", {})
        credits[f"sketchfab/{slug}"] = {
            "title": meta.get("name", slug), "author": user.get("displayName") or user.get("username", ""),
            "license": (meta.get("license") or {}).get("label", lic), "url": meta.get("viewerUrl", ""),
            "source": "Sketchfab", "faces": meta.get("faceCount")}
        print(f"  sketchfab {slug}: {meta.get('name')} by {user.get('username')} [{lic}]")


# ---------------------------------------------------------------- direct zip downloads (OpenGameArt etc.)

def direct(cfg: dict, credits: dict) -> None:
    cache: dict[str, bytes] = {}
    for dest, spec in cfg.items():
        if spec["url"] not in cache:
            cache[spec["url"]] = get(spec["url"])
        with zipfile.ZipFile(io.BytesIO(cache[spec["url"]])) as zf:
            data = zf.read(spec["member"])
        save(ASSETS / dest, data)
        credits[dest] = {"title": spec["title"], "author": spec["author"], "license": spec["license"],
                         "url": spec["page"], "source": "OpenGameArt"}
        print(f"  direct {dest}")


def write_credits(credits: dict) -> None:
    CREDITS_JSON.write_text(json.dumps(credits, indent=2, sort_keys=True))
    lines = ["# Asset credits", "", "Generated by `tools/assets/fetch_assets.py`. Do not edit by hand.", "",
             "| Asset | Title | Author | Licence | Source |", "|---|---|---|---|---|"]
    for key in sorted(credits):
        c = credits[key]
        lines.append(f"| `{key}` | [{c['title']}]({c['url']}) | {c['author']} | {c['license']} | {c['source']} |")
    lines += ["", "Black Clover characters and designs © Yūki Tabata / Shueisha. Fan-made models are used under their",
              "Creative Commons licences for a personal, non-commercial fan project only."]
    (ASSETS / "CREDITS.md").write_text("\n".join(lines) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["polyhaven", "sketchfab", "direct"])
    args = ap.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    credits = json.loads(CREDITS_JSON.read_text()) if CREDITS_JSON.exists() else {}
    failed = 0
    for source, fn in (("polyhaven", polyhaven), ("direct", direct), ("sketchfab", sketchfab)):
        if args.only and args.only != source:
            continue
        print(f"[{source}]")
        try:
            fn(manifest.get(source, {}), credits)
        except Exception as e:  # keep going so one bad source doesn't block the rest
            failed += 1
            print(f"  ERROR {source}: {e}", file=sys.stderr)
    write_credits(credits)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
