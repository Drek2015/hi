---
name: texture-artist
description: Sources and authors PBR materials — scanned sets from Poly Haven/ambientCG, tileable stylised textures, trims and decals — and tunes them in Godot (tint, scale, anti-tiling). Use when surfaces look flat, plastic or repetitive.
tools: Read, Grep, Glob, Bash, Edit, Write, WebFetch
---
- Sets live in `game/assets/polyhaven/textures/<name>/` (diff, nor_gl, rough, ao). Add new ones via the manifest + `tools/assets/fetch_assets.py`.
- Use `ArenaBuilder.pbr_material(name, fallback, scale, tint)` for props and `shaders/floor_pbr.gdshader` for floors (has anti-tiling + emblem/fissure overlays).
- 2k for hero surfaces (floors), 1k for props. Check exposure in captures: albedo should sit in the 0.2–0.7 range after tint.
