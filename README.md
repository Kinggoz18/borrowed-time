# Borrowed Time

Settle an empty island that keeps its own time, borrow daylight from a polite lender, and survive the dusk. Mobile game by Stardust Crusaders: TypeScript, Vite, PixiJS v8, Capacitor.

Plan: `docs/FINAL_PLAN_BT.md`. Rules and formulas: `docs/DESIGN_V2.md`. Lore: `docs/LORE.md`. Art: `docs/ART_BIBLE.md`.

**Current state: Phase 1, playable from empty land to Village.** Pure rules core with all §6 sim gates (`docs/SIM_GATES.md`), save/resume, and a phone-playable build in the Colony and Village looks. Plan: `docs/PHASE1_PLAN.md`. Decisions: `docs/DECISIONS.md`. Review: `docs/PHASE1_REVIEW.md`. The Phase 0 stress scene stays at `?stress=1`.

## Requirements
- Node 22 or newer. The Capacitor CLI needs it; Vite and the tests also run on Node 20.
- For the Android APK: Android Studio, which brings the Android SDK and Java.

## Play it on your Android phone (Mac)
1. Install Node 22+ (`brew install node`) and Android Studio. Open Android Studio once so it downloads the SDK.
2. On the phone: Settings → About phone → tap *Build number* 7 times; then Developer options → *USB debugging* on. Plug it in and accept the prompt.
3. In the repo: `npm ci`, then **`npm run apk:play`**. It builds the game, syncs Capacitor, runs Gradle and installs `borrowed-time-play.apk` with `adb` if the phone is connected (`brew install android-platform-tools` for `adb`, or use `~/Library/Android/sdk/platform-tools/adb`). Without a cable: AirDrop/Drive the APK to the phone and open it (allow "install unknown apps").
4. `npm run apk:gate` builds the Phase 0 perf-gate APK (`borrowed-time-gate.apk`, stress scene + perf panel) the same way.

## Run in a browser
```bash
npm install
npx playwright install chromium   # once, for e2e
npm run dev                       # http://localhost:5191 (dev build: Debug button in the HUD)
```
URL options: `?tier=low|mid|high` forces a quality tier; `?stress=1` opens the Phase 0 stress scene.

## Test
```bash
npm run ci          # lint, typecheck, unit tests, sim gates, production build, Playwright e2e
npm test            # Vitest: rules, parity with the prototype, determinism, save, layout, session
npm run test:gates  # the 27 §6 sim gates (about 2 minutes on 8 cores)
npm run sim         # the full sim report
npm run test:e2e    # Playwright at 360x800 and 540x960 (needs `npm run build` first)
```
The e2e runs are software-rendered (headless Chromium, SwiftShader); their fps is not a phone result. Screenshots go to `.artifacts/<BT_RUN>/e2e/`.

## Layout
- `src/core`: the pure rules (no Pixi, no DOM; ESLint enforces it): engine, bots, gates, hints, snapshots, command/event log, saves.
- `src/game`: session (clock, autosave), settings, boot. `src/ui`: DOM screens. `src/render/island`: the Pixi island.
- `src/art/island`: procedural stand-in sprites in the art bible style, packed into an atlas at boot.
- `src/platform`: storage (Capacitor Preferences → localStorage → memory), sound cues, haptics.
- `src/sim`, `src/render/scene.ts`, `src/perf`: the Phase 0 stress scene and perf gate.
- `tests`, `tests/sim`, `e2e`: Vitest, sim gates, Playwright. `android`: the Capacitor project (no signing keys).
