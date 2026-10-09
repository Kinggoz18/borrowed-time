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

## Pass 2
See the end of this file once pass-1 fixes are in.
