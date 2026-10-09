# Phase 0: results so far

**Status: unproven.** The stress scene runs and is measured on the build box, but the box has no phone GPU. The gate passes or fails only on a real phone (`PHASE0_DEVICE_TEST.md`).

**Decision rule:** fail = report to the owner with the numbers and options; the owner decides.

## What the scene shows
A City-tier worst case, with no game logic (`src/sim`, drawn by `src/render/scene.ts`):
- **Island:** a 21×21 island holding the City building counts (81 buildings), with every lot built.
  - 32 buildings spread to 2×2 and 3×3 at looks 5–7. The 40 cottages merge into terrace blocks, 9 fields stay 1×1, and 69 more terrace blocks fill the rest (150 building sprites).
  - The City counts don't fit 21×21 at full footprints, so the plan's "every building at looks 5–7" can't happen literally.
  - The full 7th-stage palisade ring (88 pieces, 12 gates) and hour-line roads.
  - Outskirts, piers, Hesper's tent and the gnomon with its moving shadow.
- **People:**
  - 48 crowd clusters (1,584 animated figures).
  - 50 / 32 / 20 villagers on a work day (paper puppets of 6 pinned parts; baked 2-frame poses on low).
  - 24 / 16 / 12 raiders and 6 boats.
- **Effects:**
  - Fire on 6 buildings, smoke, sparks and arrows (300 particles, 150 on low).
  - About 400 window and torch glows.
  - Grey land on half the lots: a shader that desaturates, cools and hatches.
  - The full-screen day/night tint over baked-light art, the paper grain and the vignette.
  - Bloom on the high tier, and the Town → City era wash every 30–75 s.
- **Camera:** pans and zooms, then settles. The static ground is baked to a texture when the camera settles.
- **Art:** procedurally drawn **stand-ins** at final frame sizes and atlas layout (`public/standin/`, `npm run standins`). The high tier uses a 128×64 tile; the low tier is a separate half-size export with 2 px lines.
- **Modes:** Loop (day → dusk → night → dawn every 2 min), Worst (night raid, fire, max particles, fast zooming), and the 10-minute check (worst load, with minute-by-minute fps).
- **Tiers:** Low, Mid and High, chosen automatically from the GPU, RAM and cores, or picked by hand. The tier steps down when the p95 frame time stays over 25 ms.

## Measured on the box (software-rendered: sanity only)
Headless Chromium with SwiftShader (a CPU stand-in for a GPU) on a cloud VM, 360×800 at DPR 2, 20 s per run, from the production build. **These frame rates say nothing about a phone.** They only show that the scene runs, stays inside the draw-call budget and records correctly.

| Tier | Mode | fps median (software) | Worst second | Frame p50 / p95 / p99 (ms) | Draw calls | Texture memory (est.) | Web start |
|---|---|---|---|---|---|---|---|
| Low | Loop | 27.5 | 21.2 | 33 / 48 / 56 | 10–11 | 31 MB / 80 | 0.56 s |
| Low | Worst | 25.6 | 20.4 | 37 / 47 / 63 | 10–11 | 32 MB / 80 | 0.55 s |
| Mid | Loop | 12.8 | 10.1 | 70 / 96 / 141 | 10–11 | 104 MB / 128 | 0.91 s |
| Mid | Worst | 13.2 | 8.5 | 73 / 98 / 168 | 10–14 | 104 MB / 128 | 0.91 s |
| High | Loop | 6.7 | 4.9 | 125 / 185 / 242 | 17–20 | 117 MB / 128 | 1.08 s |
| High | Worst | 6.8 | 4.8 | 135 / 195 / 293 | 17–20 | 119 MB / 128 | 0.92 s |

What these numbers do show:
- **Draw calls are GPU-independent:** 10–14 on low and mid, and 17–20 on high, against a budget of under 60. Batching, atlases, the ground bake and particle containers hold up.
- **Texture memory is inside both budgets, but tight on high.** It's estimated from every texture the renderer has uploaded, as uncompressed RGBA, plus the screen buffers:
  - High is about 80 MB of atlases (two City building pages, one Town page for the era wash, terrain, units, FX and grain) and about 38 MB of render targets (ground bakes, filters, bloom and screen buffers).
  - Shipped KTX2/ASTC atlases are a quarter of RGBA, so the real art should land around 60 MB on high.
- **Low is about 4× cheaper than high in software,** which is roughly the 4× pixel count from DPR 1 vs 2 plus bloom.

## Unproven until a phone runs it
- All frame rates: typical 60 fps, a worst-load floor of 30 fps, and the frame-time spread.
- Thermals over 10 minutes. The web view can't read Android's thermal state, so use `adb shell dumpsys thermalservice` (see the device test).
- Startup from tap to scene. The app times only the web part (navigation start to the second full frame); the native launch and splash come on top.
- Real GPU memory on the device (`dumpsys meminfo`), and how the Android WebView compares to desktop Chromium.
- Whether auto-detect picks the right tier on the actual phones.

## Notes and challenges (decisions I'd question)
1. **The 1,600-figure crowd is heavier than the shipped design.** The plan's §5 gate lists 48 crowd clusters, but §2 replaces clusters with sampled figures capped at 50 / 32 / 20. I kept the crowd on by default so the gate errs heavy. If a phone fails only with the crowd on, re-run with **Crowd** off before anyone decides anything.
2. **Bloom is on the glowing layer only:** windows, torches, fire and sparks, at half resolution. The art bible forbids blanket bloom, so a full-screen bloom would measure an effect we'd never ship.
3. **The stand-ins are PNG (RGBA), not KTX2.** The plan's starter prompt asks for KTX2 stand-ins. That needs a Basis encoder in the build and the transcoder in the app, and I didn't add either.
   - The effect is that memory and texture bandwidth are pessimistic (about 4× on atlases).
   - If the phone is borderline on fps or memory, the KTX2 pipeline is the first thing to add.
4. **Both era sets stay loaded for the whole run.** The plan loads the next set only during the cinematic. Keeping both is a worst case of about +21 MB on high. The era wash swaps the building looks; the full 5–8 s cinematic is Phase 2 work.
5. **The grey-land hatch is drawn before the night tint**, inside the grey shader. The art bible says after. The tint tops out at 52%, so the hatch still shows, but check it at night on the phone.
6. **Tier drops reload the scene** at the lower tier. This is fine for the test harness. The game should switch tiers at a natural break.
7. **The optional normal-mapped lighting pass isn't built.** Baked light is the baseline (art bible decision D3). Measure that pass separately only if you want it.
8. **Draw-call counts include the bake and bloom passes** and lag by one frame.
9. **The Capacitor CLI needs Node 22.** The box has Node 20, so `cap add android` ran on a temporary Node 22. Your Mac needs Node 22 or newer.

## APK
The box can't build an APK: it has no JDK, no Android SDK and no Gradle cache. I didn't install them.
- The Android project is set up in `android/` with no signing keys.
- `PHASE0_DEVICE_TEST.md` has the build steps for your Mac.

## Options if the phone fails (for the owner)
Put the numbers next to these options. None of them is chosen yet.
- **Re-measure without the stress extras:** turn **Crowd** off and use the Low tier. If that passes, the shipped design (≤ 50 figures) fits.
- **Cut weight:**
  - add KTX2 atlases;
  - load one era set at a time;
  - make Low the default on Mali-G52/Adreno 610 phones (auto-detect already does this);
  - shrink the ground bake margin or cap the DPR at 1.5 on mid;
  - drop the vignette or grain on low.
- **Change the art plan:** fewer layers or a smaller atlas set.
- **Another engine,** such as Unity 2.5D with URP. The pure TS rules port to C# cheaply. Only on the owner's say-so.
