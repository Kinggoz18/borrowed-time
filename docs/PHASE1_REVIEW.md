# Phase 1 review

Strict reviewer passes over the Phase 1 diff (e10f932..main) and the e2e screenshots. Each
finding has a severity, the fix, and the commit area. Passes repeat until a pass finds nothing
above "note".

## Pass 1

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | high | `npm run lint` was red since the parity commit: ESLint linted the vendored `tests/reference` sim and the `.cache/sim` bundle. | Ignored both in `eslint.config.js`. |
| 2 | high | Four §6 gates failed on the first port (Colony 97%, City 70%, leverage dominant in Village and Town). | Lore-backed balance pass, DECISIONS #6; parity still tested on the baseline via `useRuleset("prototype")`. |
| 3 | high | Playwright's `reuseExistingServer` would have attached to another project's dev server on the default port 5173 on a shared machine. | Moved dev/preview to 5191/4191. |
| 4 | high | The arc could not reach Village in e2e: people who can't be fed or housed leave at dawn before the tier check, while the HUD showed "45/36 people" as met. | Charter sheet now shows food and homes and says what to build (DECISIONS #13). The e2e builds and upgrades Fields, Cottages and Towers like a player. |
| 5 | high | `apk:gate` would have shipped the game instead of the Phase 0 stress scene. | The `gate` build boots the stress scene; `apk:play` builds the game. |
| 6 | med | The coach pulse moved the Build button (transform), so it was never "stable" to tap in tests and jittered under the finger. | Glow-only pulse. |
| 7 | med | `#ui > *` re-enabled pointer events on the full-screen layer, eating every tap on the island and the bottom bar. | Pointer events only on buttons, chips, sheets, cards. |
| 8 | med | Centred cards hid the island during dusk and raids. | Cards sit at the bottom; the island stays visible above. |
| 9 | med | The debt chip's "Owed · near limit" overflowed under the settings button at 360 px; the charter chip clipped "Over limit". | Chips shrink and wrap; see pass 2 screenshots. |
| 10 | med | The dusk "is it already open" guard checked a `data-card` attribute nothing set. | A real in-progress flag. |
| 11 | med | Rest 8× stayed highlighted (aria-pressed) after dusk reset the speed to 1×. | Reset the button state with the speed. |
| 12 | med | Beached trophy boats kept textures from the previous era's atlas after a tier-up. | Destroyed with the old atlas. |
| 13 | low | Dev level-ups (debug panel) showed no toast or sound. | Same cue and toast as a real level-up. |
| 14 | low | The dusk card's shield icon wrapped onto its own line. | No wrap in card sub-lines. |
| 15 | note | `__bt` read-only hooks (state, stats, played cues) ship in production. | Kept: read-only, used by the device checks; documented. |
| 16 | note | The event log grows for the island's lifetime inside the save (a few events a night). | Fine for Phase 1 (≈ 1 KB a season); cap or archive per season in Phase 2. |
| 17 | note | The atlas pages stay in CPU memory for DOM thumbnails (≈ 16 MB at the high tier). | Acceptable; Phase 2 painted atlases ship PNG thumbnails. |

Pass-1 fixes 9–12 and 14 landed in "Trim the HUD and fix dusk and rest button state" and "Make buildings bigger and easier to tell apart". Finding 8 was later replaced by the landscape layout (pass 2, #1).

## Pass 2 (after the owner's screenshot feedback; landscape screenshots in `.artifacts/p1-land/`)

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | high | The game is played in landscape; the build was portrait (bottom bar, bottom sheets, 360×800 tests). | Landscape lock (Android, manifest), top HUD strip, right action rail, side sheets, centred two-column cards, an upright-browser note; e2e at 800×360 and 960×540 (DECISIONS #15). |
| 2 | high | The island was small and buildings tiny and hard to tell apart, worst on grey land. | Camera fits the ring, play starts 1.6× closer, buildings 1.3× their lot, one signature mark per type, grey buildings keep half their colour (DECISIONS #17). |
| 3 | high | People did not follow the bible's paper puppets (size, parts, pins, job colours, Hesper). | Redrawn to spec; Hesper stands at her tent (DECISIONS #18). Sheet: `.artifacts/p1-land/people-sheet.png`. |
| 4 | med | Hesper's borrow and repay buttons sat below the fold at 360 px tall. | Two-column sheet; every action visible without scrolling. |
| 5 | med | New buildings go to the safest (back) lot, often off screen or under the HUD at the closer zoom. | The camera glides to a new building that lands outside the island area. |
| 6 | med | The charter chip clipped "Over limit"/"Seal" at 800 px wide. | Shows only what still blocks the next tier (at most two items), "Ready" when nothing does. |
| 7 | med | The arc test raced the tier card (it arrives after the morning cards) and a blocked tap waited out the 15-minute test. | Wait for the screen to clear; 30 s action timeout. |
| 8 | low | Perf/stress suites ran in CI while paused by the owner. | Opt-in with `RUN_STRESS=1` (DECISIONS #16). |
| 9 | low | The plan still allowed interstitial ads. | Rewarded video only (DECISIONS #14). |
| 10 | note | The seizure card shows Hesper's tent, not the building she took (the lift animation does show it). | Phase 2: the card art follows the seized building. |
| 11 | note | People animate with the two baked poses only (the bible's low tier), not pin-driven sine motion. | Phase 2 with the painted parts. |
