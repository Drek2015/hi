# Free & cheap asset sources — research index

Maintained by the **research** team (research-lead, asset-scout, tech-scout, license-auditor).
Verified from this cloud session on 2026-11-06. ✅ = fetched automatically; 🔑 = needs an account or token from you; 🖐 = one manual download.

## Already in the game
| Source | What we use | Licence | How |
|---|---|---|---|
| [Poly Haven](https://polyhaven.com) | 2 HDRI skies, 7 scanned PBR texture sets, 4 scanned models (boulder, moon rock, dead tree, grass) | CC0 | ✅ `tools/assets/fetch_assets.py` (public API) |

Poly Haven tree scans are 60–480 MB each, which is too heavy for gameplay, so we skip them. Two HDRIs were rejected in review: *the_sky_is_on_fire* shows apartment blocks, and *qwantani_night* looks washed out.

## Black Clover fan models (Sketchfab, CC-BY, downloadable)
Found with `api.sketchfab.com/v3/search?downloadable=true`. All are CC-BY: credit the author, modifications allowed. Use is limited to this personal, non-commercial fan project.

| Model | Author | Faces | Use |
|---|---|---|---|
| [Asta's sword Demon Slayer](https://sketchfab.com/3d-models/dd428a167e11417482ec00fac9bb4b6f) | Gioia2 | 2.8k | Base-form viewmodel |
| [Black Clover – Asta Swords](https://sketchfab.com/3d-models/67255daf660d4c669857986b5db37c30) | GremorySaiyan | 4.0k | Sword set |
| [Demon Dweller](https://sketchfab.com/3d-models/b7ed730bac5d4237b08203282065e160) | Gustavo_Ribeiro | 1.4k | Q ability |
| [Demon Destroyer Sword](https://sketchfab.com/3d-models/c1b534c8af42459d936805d43d6865fa) | Reggie.Gabber | 1.2k | Devil Union left hand |
| [Black Divider](https://sketchfab.com/3d-models/c48274c0419e46cbbe766a73c0937544) | bbonless | 21.6k | Black Form |
| [Asta's Grimoire](https://sketchfab.com/3d-models/0ffb07be77c04bca9441885fde56fd49) | royalguarding | 156 | Menu / HUD prop |
| [Yuno Spirit Of Zephyr](https://sketchfab.com/3d-models/3086ee0b2d4643dc84669cf93f883744) | Reggie.Gabber | 143k | Yuno boss (decimate to about 40k) |
| [Gimodelo](https://sketchfab.com/3d-models/e0fb3421344b4872a094b5551c024400) | Reggie.Gabber | 18k | Nacht phase 2 |

Status 🔑: the Sketchfab API currently answers *Invalid API token*. Create a token at sketchfab.com → Settings → Password & API → **API Token**, save it again for host `api.sketchfab.com`, then run `python3 tools/assets/fetch_assets.py --only sketchfab`.
Rejected: "Five leaf Grimoire" (NoDerivs licence), Roblox/Minecraft conversions (wrong art style), and the 716k-face "Asta" model (far over budget; probably a figure scan).

## Characters & animation (CC0)
| Source | Contents | Status |
|---|---|---|
| [Quaternius Universal Base Characters](https://quaternius.itch.io/universal-base-characters) | Rigged humanoid bodies on the universal rig | 🖐 free download (itch.io blocks scripts) |
| [Quaternius Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) | Melee combos (3- and 4-hit, split into hits and recoveries), parkour and more; glTF | 🖐 free Standard tier |
| [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | 45 free / 120+ pro animations, retarget-ready for Godot | 🖐 |
| [VRoid Studio](https://vroid.com/en/studio) + [CC0 VRoid samples](https://opengameart.org/content/vroid-studio-cc0-models) | Anime-style bodies and hair; export VRM and import with the MIT [Godot VRM addon](https://godotengine.org/asset-library/asset/edit/23034) | 🖐 Free desktop app: the best route to faithful anime-style Asta, Yuno and Noelle |
| [Mixamo](https://www.mixamo.com) | Thousands of mocap clips | 🔑 free Adobe account |

Drop downloaded zips into `game/assets/inbox/`. The rigger-retargeter agent unpacks them, maps bones to `SkeletonProfileHumanoid` and builds a shared AnimationLibrary.

## AI generation (free / open)
| Tool | Purpose | Notes |
|---|---|---|
| Pollinations image API | Concept sheets, no key | Works here, but quality is low (watermark, blobby shapes; see `art/concepts/`). Fine for moodboards only. |
| FLUX.1 / SDXL via Hugging Face | Proper concept art | 🔑 needs a free HF token, or a local GPU with ComfyUI |
| TRELLIS 2, Hunyuan3D 2.1 | Image to 3D mesh | Open weights; Hugging Face Spaces (rate-limited) or a local GPU. TripoSR is the light fallback (about 6 GB VRAM, MIT). |
| HY-Motion 1.0 (Tencent) | Text to motion | Open-sourced Dec 2025; needs a GPU. Use it for signature moves no library has. |
| Meshy / Tripo free tiers | Hosted image-to-3D | 10–15 exports per month, non-commercial terms |

## Recommended path to 2026-level visuals
1. **Weapons:** fix the Sketchfab token and import the 6 CC-BY Asta swords. This is the fastest visible upgrade.
2. **Bosses:** VRoid anime bodies, or Quaternius bases dressed per character, plus Quaternius UAL 1 and 2 sword combos, retargeted in Godot.
3. **Hero characters (Yuno, Lucifero):** Sketchfab fan models where they exist; otherwise concept, then TRELLIS/Hunyuan3D, then Blender cleanup.
4. **Environments:** keep scanning in CC0 kits. The next targets are a gothic castle kit (Spade Citadel) and Fab's free monthly environment packs.
