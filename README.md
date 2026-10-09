# Borrowed Time

Settle an empty island that keeps its own time, borrow daylight from a polite lender, and survive the dusk. Mobile game by Stardust Crusaders: TypeScript, Vite, PixiJS v8, Capacitor.

Plan: `docs/FINAL_PLAN_BT.md`. Rules and formulas: `docs/DESIGN_V2.md`. Lore: `docs/LORE.md`. Art: `docs/ART_BIBLE.md`.

**Current state: Phase 0, the performance gate.** The app is only the City-tier stress scene, drawn with stand-in art. No game code is written until the gate has run on real phones and the owner has decided. Results: `docs/PHASE0_RESULTS.md`. Phone steps: `docs/PHASE0_DEVICE_TEST.md`.

## Requirements
- Node 22 or newer. The Capacitor CLI needs it; Vite and the tests also run on Node 20.
- For the Android APK: Android Studio, which brings the Android SDK and Java.

## Run
```bash
npm install
npx playwright install chromium   # once, for e2e and the stand-in generator
npm run dev                       # http://localhost:5173 (perf panel shown)
```
URL options:
- `?tier=auto|low|mid|high`
- `?mode=loop|worst|throttle`
- `?crowd=0` turns off the 1,600-figure crowd.
- `?minutes=10` sets the length of the throttle check.

The perf panel has the same switches and **Save CSV**.

## Test
```bash
npm run ci          # lint, typecheck, unit tests, production build, Playwright e2e
npm run lint
npm run typecheck
npm test            # Vitest: sim data, packer, recorder, gate checks, tiers
npm run test:e2e    # Playwright at 360x800 and 540x960 (needs `npm run build` first)
```
- The e2e runs are software-rendered (headless Chromium with SwiftShader). They prove the scene boots, renders, has no console errors and records frame times. Their fps is not a phone result.
- To keep the e2e CSVs, set `BT_EVIDENCE=<folder>`.

## Builds
| Command | What |
|---|---|
| `npm run build` | Production web build, with no perf panel |
| `npm run build:gate` | Test build, with the perf panel kept |
| `npm run apk:gate` | Test build, `cap sync`, then the debug APK at `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run standins` | Redraws the stand-in atlases into `public/standin/` |

## Layout
- `src/sim`: pure, seeded scene data (island, people, particles, camera, day cycle, command log). It has no rendering.
- `src/render`: the Pixi scene, atlases and the grey-land shader.
- `src/perf`: frame recorder, CSV, gate checks, quality tiers and the perf panel.
- `src/art`: the stand-in art generator and atlas packer.
- `tests`, `e2e`: Vitest and Playwright.
- `android`: the Capacitor Android project. It has no signing keys.
