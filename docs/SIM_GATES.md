# Sim gates (FINAL_PLAN_BT.md §6)

`npm run test:gates` (also in `npm run ci`) runs the headless sim: the five strategy bots
(never borrow, balanced, leverage, borrow max, reckless) each play **24 colonies × 45 seasons
from empty land = 1,080 seasons per strategy**, in parallel Node processes (`scripts/sim.mjs`
bundles `src/core` with `scripts/sim-entry.ts`). About 2 minutes on 8 cores. Each gate is one
Vitest test named by its id in `tests/sim/gates.sim.test.ts`; the build fails if any is false.
`npm run sim` prints the full report.

| Test id | §6 gate | Threshold | Result (rules v2-build.2) |
|---|---|---|---|
| G1-Colony / Village / Town / City | Season-win bands | competent mean (never, balanced, leverage) inside 65–95 / 55–85 / 45–75 / 35–65% | 92 / 74 / 57 / 53% |
| G2-Colony … City | No dominant strategy | no strategy is best at both boss wins and growth | pass at every tier (balanced wins most, leverage grows most from Village up) |
| G3-Colony … City | Borrowing matters at every tier | a borrowing bot beats never by ≥ 10% growth or ≥ 8 pts wins | growth +59 / +43 / +51 / +35% |
| G4-borrowMax, G4-reckless | Greed loses | boss wins < 10% (or no growth) and Village reached by < 50% | 0% and 0/24 for both |
| G5 | Smooth levelling | each level's days-to-next 0.5–2.2× the previous | 3 → 4 → 6.8 → … → 22.2 days |
| G6 | Breathers | the raid after a loss or a Long Dusk is weaker, never stronger | 5,122 / 5,340 weaker, none stronger |
| G7-Colony … City | Pacing (plan §3 plateau fix) | 6-day income growth p5 ≥ 10 / 3 / 1 / 0.5% | 62.4 / 9.4 / 5.3 / 0.8% |
| G8-Colony … City | Pacing | never more than 2 / 3 / 3 / 4 days without an advancement | 1 / 2 / 2 / 3.5 days |
| G9-Colony / Village / Town | Pacing (new): player-time seasons per tier | balanced bot: Colony ≤ 2, Village 4–6, Town 8–10 seasons | 1.8 / 5.8 / 9.1 |

Every §6 gate is ported; none were dropped. Tests also check that the judge reports exactly
this catalogue (`GATE_IDS` in `src/core/gates.ts`).

## How the bots differ from the prototype harness
The bots are the `sim-test.js` bots ported 1:1 (`src/core/bots.ts`); `tests/parity.test.ts`
replays them day by day against the vendored reference on the baseline ruleset. The gates run
on the shipped Phase 1 ruleset (DECISIONS.md #6).

## Thin margins to watch
- G9-Village 5.8 seasons (limit 6) and G1-Colony 92% (limit 95%).
- G2-Town: balanced 62% / 965 growth vs leverage 60% / 986. Any change that lifts leverage's
  Town win rate by 2 points makes it dominant again.
- G7-City p5 0.8% (floor 0.5%).
