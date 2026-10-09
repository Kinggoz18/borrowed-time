# Borrowed Time

Settle an empty island that keeps its own time, borrow daylight from a polite lender, and survive the dusk. Mobile game by Stardust Crusaders: TypeScript, Vite, PixiJS v8, Capacitor.

Plan: `docs/FINAL_PLAN_BT.md`. Rules and formulas: `docs/DESIGN_V2.md`. Lore: `docs/LORE.md`. Art: `docs/ART_BIBLE.md`.

**Current state: Phase 0, the performance gate.** The app is only the City-tier stress scene. No game code is written until the gate passes on a real phone.

## Requirements
- Node 22 or newer (the Capacitor CLI needs it; Vite and the tests run on Node 20 too).
- For the Android APK: Android Studio (it brings the Android SDK and a JDK 21).

## Run
```bash
npm install
npm run dev            # http://localhost:5173 (perf HUD shown in dev)
```
