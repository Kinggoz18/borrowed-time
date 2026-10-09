# Phase 1 plan: core rules + a playable Village-era build

**Scope change (owner, Oct 9 2026):** skip the grey-box stage. Phase 1 goes straight to a build the owner can install and play on his phone, drawn in the Village-era look from `ART_BIBLE.md`. The sim core, the section 6 gates, save/resume, the event log and determinism stay exactly as planned. All art is still a **procedural stand-in** (drawn by code in the bible's style), never final art (`ART_BIBLE.md` §13).

Sources: `FINAL_PLAN_BT.md` §2–6, 11, 12 and the Phase 1 row; `DESIGN_V2.md`; `LORE.md`; `ART_BIBLE.md`; the v2 prototype (`prototype.html` core block and `sim-test.js` with `RULES=build`), which is the rules reference.

## What "done" means
1. `src/core`: TypeScript rules at parity with the prototype core plus the build patches in `sim-test.js` (`RULES=build`, default env values). Pure and deterministic: no Pixi, DOM or storage imports (ESLint boundary rule).
2. The section 6 sim gates run in Vitest, each gate named in its test title and mapped in `docs/SIM_GATES.md`. `npm run ci` fails if any gate fails.
3. `IslandSnapshot` (versioned), `resolveRaid(snapshot, strength, seed)`, a seeded RNG with serialisable state, a command log with sequence numbers, and an append-only event log. A determinism test: same seed + command log ⇒ the same snapshot hash.
4. A headless sim runner (`npm run sim`) that prints the same tables as `sim-test.js`.
5. A playable build: home → first-run flow → empty land → palisade ring → build, upgrade, borrow, repay → dusk decisions → raids → seizure → level-ups → tier-up to Village with the ring re-fit and the Village look. Real screens: home, play, build, building, Clockkeeper (borrow/repay), dusk decision, raid result, morning report, seizure, tier-up, settings. Sound hooks. Save and resume mid-day.
6. Playwright e2e at 360×800 and 540×960, plus screenshots for review.
7. A Mac script that builds and installs the APK (`npm run apk:play`), next to the Phase 0 `apk:gate`.

## Ordered chunks (each: tests first where it applies, then one plain commit)
| # | Chunk | Acceptance check |
|---|---|---|
| 1 | Seeded RNG with serialisable state; rule tables (tiers, buildings, counts, footprints, tech, events) | Unit tests: the xorshift sequence matches the prototype's `makeRng`; tables match `DESIGN_V2.md` |
| 2 | Economy rules: costMul/cost/limit, grey order and count, half output, food/housing/income with the build income curve, borrow (today+/tomorrow−), repay, interest and the Hourglass | Unit tests per rule (section 6 list) |
| 3 | Build/upgrade, counts and level caps, credit-only buildings, footprint claims, palisade ring, roads, trade, academy, hospital, exchange, harbour, observatory, Great Dial, rebuild at half price | Unit tests |
| 4 | Dusk and night: raids with ramp, breathers and the raid cap, the 3 decisions, raid damage order, salvage, captured boats, the dawn ledger, seizure (grey first, most invested, seal), nothing-to-seize fallback, morning (arrivals, leaving, homeless), tier-up gate (level + people + not over the limit + no seal), XP | Unit tests |
| 5 | **Parity test:** the TS core and the vendored prototype core (with the build patches, evaluated exactly as `sim-test.js` does) play the same campaigns and must match season by season | Bit-identical campaign records for 5 strategies × several seeds |
| 6 | Snapshot, `resolveRaid`, command log, event log, determinism test | Hash equality from replay; `resolveRaid` matches the in-game dusk |
| 7 | Bots and the section 6 gates; `docs/SIM_GATES.md`; headless runner | All gates green (or a recorded, owner-visible exception) |
| 8 | Storage interface (localStorage; Capacitor Preferences on device), versioned save with migrations, never throws | Unit tests: round trip, stale save, blocked storage, migration |
| 9 | Village-era art: procedural sprites per bible (ink outline, 3-step baked light, chunky shapes, era palettes) for Colony looks 1–2 and Village looks 1–4, ring pieces, tent, gnomon, people, boats; baked into atlases at start | Contact sheet screenshot; silhouette check by eye |
| 10 | Pixi island renderer: tiers, lots, grey shader + hatch, ring, roads, depth sort, camera fit/pan/pinch/tap-zoom, day/dusk/night tint, grain, people sample with jobs, raid playback, seizure lift, tier-up wash | E2E boot with no console errors; draw calls inside budget |
| 11 | Game loop + DOM UI screens, first-run flow, sound hooks, haptics, settings, dev-only debug panel | E2E real clicks through each screen |
| 12 | Save/resume (pagehide/visibility + every phase change) | E2E: reload mid-day restores the same state |
| 13 | E2E arc: empty land → Village, at both phone sizes, with screenshots | Green |
| 14 | `apk:play` script, docs, README | Script reviewed (box can't build an APK) |
| 15 | Strict review pass(es): findings and fixes in `docs/PHASE1_REVIEW.md` | Clean |

## Challenges to the plan (decisions recorded in `DECISIONS.md`)
- **"Parity with prototype v2" vs the unsimulated build changes.** `FINAL_PLAN_BT.md` §3 lists Phase 1 tuning items that were never simulated: surprise raid nights, jobs/posts/hunger timers, pity, catch-up, new-shore breather, first-dusk ×0.7, Hesper's trust. Adding them all at once would change balance before we know the port is right. Order: port and prove parity first (gates green on the known rules), then add tuning items one at a time with the gates as the guard. Items not landed in Phase 1 are listed in `DECISIONS.md` and the report, not hidden.
- **Hints instead of numbers at dusk.** The plan's surprise-raid rule changes the bots' information. The UI can already show the hint band and kind (a presentation change) without changing the rules the gates check, so the build shows the lore hint lines (skiffs/longboats/Long Dusk, light/even/heavy) and the defence each decision gives, not the raiders' number.
- **Gate runtime.** 5 strategies × 24 colonies × 45 seasons takes minutes. The gates run once per CI in one test file; individual rule tests stay fast.
- **Pacing gate (player-time targets).** The balanced bot's seasons per tier must sit inside the §3 targets. If the port shows the known plateau, that gate is reported honestly as a tuning item rather than loosened.
- **Greybox skipped.** The rendered build uses procedural Village-look sprites. They are clearly labelled stand-ins and follow the bible's rules (ink `#3D3428`, constants plus era materials, baked 3-step light, the blue door only on cottage look 3+, grey = debt only).
