# Borrowed Time: design v2

Round 2 of the prototype (`prototype.html`; v1 is kept as `prototype-v1.html`). The rules live in one block of the HTML, between the `CORE-START` and `CORE-END` markers. `sim-test.js` evaluates that same block, so the numbers below are the numbers the game runs on.

## The core decision (unchanged, and the thing to protect)

Hours are both money and daylight. You can borrow them from the Clockkeeper. The loan has five consequences:

- **Today runs longer, tomorrow runs shorter.** Each 5×cost-multiplier of Hours borrowed adds 1h of light today (max +3) and takes the same amount off tomorrow.
- **Front land goes grey.** Grey lots = ceil(debt/limit × lots), starting with the lots facing the sea. Buildings on grey land produce at half rate, and raiders hit them first.
- **Interest is added every night.** It is 25% of what you owe, halved by an Hourglass, and ×0.6 during the "generous Keeper" season.
- **Default seizes a building instead of ending the run.** If you owe more than your limit at night, the Clockkeeper takes your most-invested building, grey land first, and writes 60% of what you put into it off the debt. If there is nothing left to take, a villager goes to work off the debt.
- **The boss feeds on debt.** The Long Dusk (day 6) gains +0.55 × debt/cost-multiplier. Hesper's ledger **closes at dawn on day 6**: the boss uses what you owed at dawn (or more, if you borrow during the day), so repaying has to happen by the night of day 5. The day-5 hint says so.

Some items exist only on credit:

- **Lantern Hall** (Village+): big income and housing.
- **Sun Mirror** (Town+): +1h of daylight every day.

Every raid gives you a decision at dusk:

| Option | Effect |
|---|---|
| Hold the line | Normal defence. |
| Borrow the dusk | Loan of 20% of your limit; +30% defence tonight (+50% with a Harbour); tomorrow 1h shorter. |
| Everyone to the walls | Villagers count as full defenders. If the wall breaks, you lose twice as many villagers, and there is no morning bonus. |

Each season draws one random event:

| Event | Effect |
|---|---|
| Fair winds | Nothing special. |
| Long summer | +1h of daylight every day. |
| Lean harvest | Food ×0.75. |
| Generous Keeper | Interest ×0.6. |
| Red sails | Raids ×1.2. |

## Structure

- **Season:** 6 days. In the prototype there is a raid at dusk on days 2 and 4, and the Long Dusk boss on day 6. The build moves the two raids to unannounced nights (days 2–5) and announces only quiet nights; see `FINAL_PLAN.md` section 3, "Raids are a surprise". A day lasts 12h by default (minimum 7). Each hour pays income/12.
- **Start:** empty land. Level 1, 8 Hours, 6 people (the first ferry trip; the rest of the 41 founders arrive over the first days, at most 8 a day), no buildings, no wall. The tutorial asks: "Borrow 10 Hours? We're starving."
- **Build:** everything starts at level 0 and upgrades (cap 20). **The look changes every 3 levels, giving 7 looks** (`stageOf(n) = min(6, floor(n/3))`): rough (L0+), settled (L3+), timber (L6+), sturdy (L9+), stone (L12+), fine (L15+), grand (L18+). The building sheet shows "look k/7 · next look at level X". The table below is the **era-agnostic master** (what each look *is* for gameplay and footprint). Each era re-draws it in its own materials, with its own 7-look column per type: see `ART_BIBLE.md` §9 (Village written in full, others stubbed).

| Building | rough | settled | timber | sturdy | stone | fine | grand |
|---|---|---|---|---|---|---|---|
| Field | Sprouts | Fenced plot | Fenced wheat | Wheat + scarecrow | Shed (2×2) | Barn (2×2) | Windmill farm (3×3) |
| Cottage | Tent | Lean-to | Thatched hut | Timber house | Stone house | Townhouse | Tall townhouse |
| Clockworks | Bench | Shed | Workshop | Brick works | Clock works (2×2) | Twin chimneys (2×2) | Clock-tower factory (3×3) |
| Watchtower | Stilts | Log tower | Timber tower | Roofed tower | Stone tower | Spire (2×2) | Fortified keep (2×2) |
| Hourglass | Crate | Stall | Kiosk | Pavilion | Rotunda (2×2) | Domed hall (2×2) | Golden dome (3×3) |
| Lantern Hall | Lantern tent | Pavilion | Timber hall | Long hall | Stone hall (2×2) | Spired hall (2×2) | Grand hall (3×3) |
| Sun Mirror | A-frame | Stand | Pedestal | Twin mirror | Array (2×2) | Tall array (2×2) | Beam tower (3×3) |
| Trade Post | Crates | Stall | Warehouse | Counting shed | Trading house (2×2) | Hall with flag (2×2) | Guild hall (3×3) |
| Academy | Slate | Schoolroom | School | Colonnade | Stone school (2×2) | Clock school (2×2) | Domed academy (3×3) |
| Hospital | Tent with cross | Cabin | Ward | Two wards | Infirmary (2×2) | Wings (2×2) | Great hospital (3×3) |
| Exchange | Desk | Booth | Office | Columned office | Bank hall (2×2) | Clock hall (2×2) | Temple of credit (3×3) |
| Harbour | Jetty | Boat shed | Crane | Pier house | Lighthouse (2×2) | Lit harbour (2×2) | Flagship dock (3×3) |
| Observatory | Telescope | Shed | Stone hut | Tower | Dome (2×2) | Tall dome (2×2) | Great dome (3×3) |

- **Footprints:** from look 5 (L12+) most buildings take a 2×2 block, and at look 7 (L18+) a 3×3, but only into free lots behind them; with no free land they stay 1×1 and simply grow taller. From Town up, neighbouring cottages merge into terraces and then dense street blocks (taller again at City).
- **Palisade:** bought from Build (no lot needed). It is a **ring around the settlement perimeter**, with segments, 4 gates and corner posts, and it re-fits when the settlement grows. **7 stages**, on the same 3-level cadence: stakes, woven stakes, log wall, log wall with a walk, stone, stone with towers, fortified stone with gatehouses and flags. It gives 6+3n defence. Leftover raid hits knock it down a level.
- **Roads** (Village unlock) are drawn along the dial's hour-lines with 7 looks of their own: dirt tracks to paved avenues with lamps.
- **Settlement tiers** are gated by player level **and** population. In the *prototype*, the island also only grows at the end of a season in which you **held the Long Dusk and Hesper seized nothing**. That rule has no lore reason and is **removed for the build** (see the lore audit below) (the season panel says what is still missing). Each tier unlocks one **system**, and every system touches borrowing:

| Tier | Player level | People to reach | Grid | People cap | Building level cap | Loan scale | Raid scale | Unlocks |
|---|---|---|---|---|---|---|---|---|
| Colony | 1 | – | 7×7 | 41 (the founders) | 5 | ×1.2 | ×1 | Field, Cottage, Clockworks, Watchtower, Hourglass, Palisade |
| Village | 4 | 36 | 11×11 | 160 | 11 | ×1.25 | ×0.95 | **Roads**, **Trade Post**, Lantern Hall (credit) |
| Town | 8 | 120 | 15×15 | 500 | 17 | ×2 | ×1.08 | **Academy**, **Hospital**, Sun Mirror (credit) |
| City | 12 | 380 | 21×21 | 1,600 | 20 | ×2.8 | ×1.22 | **Exchange**, **Harbour**, **Observatory** |

A tier-up card lists the new land, people cap, level cap and what's new, plus one lore beat (see `LORE.md`).

**The tier systems** (one building, one clear mechanic, one link to borrowing; numbers are starting targets, the build-only parts are Phase 1 tuning work):

| System | What it does | Problem it solves | Lore reason | How it touches borrowing |
|---|---|---|---|---|
| Roads (Village) | +(5+n)% building output; a worker more than 4 tiles from work without a road loses 20% (build) | Spread-out villages waste the day walking | [laid on the dial's hour-lines; the shadow walks them like a lamplighter] | Raiders run them too: a lost raid does one more hit |
| Trade Post (Village) | Caravans stake Hours at dusk and return × tomorrow's price; in a lean season, buy food at the market price (build) | Lean seasons starve a growing village; spare Hours have no use | [sails from other dials trade by the tide] | You can stake, or buy food with, borrowed Hours |
| Academy (Town) | One research a night: Ledgers, Crop rotation, Crossbows, Clockwork looms | Long-term growth has no lever besides more buildings | [Ada studies at night] | Paid up front, pays daily: the good loan |
| Hospital (Town) | (40+2n)% of people lost in a raid come back wounded after 2 days instead; sick people in plague events recover (build) | Raid and plague losses spiral a village | [the Stitch: a stitch in time] | Makes losing a raid while in debt survivable |
| Exchange (City) | Interest ×(0.7−0.01n), credit limit ×(1.15+0.01n) | Late debt is too expensive to use | [a counting house on Aster's plan] | Refinancing: cheaper, longer debt |
| Harbour (City) | +(8+3n) defence; borrowing the dusk gives ×1.5 instead of ×1.3; captured boats moor here | The dusk loan stops paying off late | [the *Nick of Time* rows out to meet the Late] | The dusk loan becomes a weapon |
| Observatory (City) | Raid hints name the kind and give a ±10% range instead of ±25% (build; was an exact forecast); the Long Dusk feeds on (40+n)% less debt | Big dusk bets are blind guesses | [Ada can count oars, not intentions] | Carry debt into day 6 with a better, never perfect, read |

Each tier also caps how many of each building you can have:

| Building | Colony | Village | Town | City |
|---|---|---|---|---|
| Field | 3 | 5 | 8 | 12 |
| Cottage | 4 | 10 | 20 | 40 |
| Clockworks | 2 | 4 | 7 | 10 |
| Watchtower | 2 | 4 | 7 | 10 |
| Hourglass, Palisade | 1 | 1 | 1 | 1 |
| Lantern Hall (credit) | 0 | 1 | 1 | 1 |
| Sun Mirror (credit) | 0 | 0 | 1 | 1 |
| Roads, Trade Post | 0 | 1 | 1 | 1 |
| Academy, Hospital | 0 | 0 | 1 | 1 |
| Exchange, Harbour, Observatory | 0 | 0 | 0 | 1 |

- **The City view:** 21×21 lots inside the wall, plus drawn (non-interactive) outskirts beyond it that grow with the tier: farm plots, huts, windmills, a tree belt, avenues on the axes, and docks with 1+tier piers and boats. The camera auto-fits each tier (zoom about 0.75 Colony, 0.55 Village, 0.44 Town, 0.33 City). Pinch or wheel to zoom, drag to pan, tap to zoom in when zoomed out (below 0.5), and a ⤢ button re-fits.
- **People on screen (playtest: the crowd clusters are overcrowded).** The prototype draws crowd clusters, one per ~35 people up to 48. The build replaces them with a **representative sample**: one visible figure per N people (2 / 5 / 12 / 30 per tier), capped at 20 / 30 / 40 / 50 figures (high quality; 16 / 22 / 28 / 32 mid, 12 / 14 / 18 / 20 low). Each figure has a job: working at a building, walking the roads, gathering at the plaza at dusk, or manning the walls during a raid. Density follows the time of day (100% by day, about 15% at night) and events (raid, market, festival). The caps exist because each figure costs a sprite, a depth-sort entry and a path step every frame, and because a few people with jobs read better than a crowd and never hide the grey-land signal. The HUD still shows the real head count. Full rules in `FINAL_PLAN.md` section 2.

### People, jobs and food (build; makes the prototype's rules explicit)
The prototype has food (fields) and housing (cottages), hungry people who leave at dawn, and people who pay in and defend as 1.5·√fed and 0.6·√fed. It has no jobs. The build makes people a real resource. All numbers are starting targets and Phase 1 tuning work.
- **Jobs** [the dial pays for work, not for presence]: buildings provide job slots: Field 4, Clockworks 4, Trade Post 3, Academy 3, Hospital 3, Hourglass 2, +1 per look stage. A person in a slot produces 1.2 Hours a day × costMul; a building's own output needs at least half its slots filled. Idle people produce nothing. The cap is the slots: per-tier building counts cap them.
- **Posts** [people are the colony's last defence]: each Watchtower has 2 posts and the palisade 4, +1 per stage. A staffed post adds 1.5 defence × ramp. "Everyone to the walls" fills spare posts with idle people (up to double the posts), at the usual people-loss risk.
- **Food** [fields feed people, and nothing else does]: each person eats 1 food a day. Fields make 10+7n only with half their slots filled (25% unstaffed). Lean seasons ×0.75; the Trade Post can import food.
- **Hunger:** on day 1 of a shortfall the unfed go idle and greyed (no work, no posts). From day 3, half of the hungry families leave at dawn [they row back toward the lights on the horizon]. Feeding them again stops it at once.
- **The village never dies.** The founder and five founders always stay [the first six never leave the dial]. If people fall below half the tier's people gate, the newest district goes dark: its buildings stop working and grey out, nothing is deleted, and it relights when people return. The tier and the save are never lost.
- **Why no game over:** on mobile, a deleted save is an uninstall. A dark district is visible, readable and recoverable, and the loss still hurts.

- **Player XP** (max level 20):

| Source | XP |
|---|---|
| Build | +2 |
| Upgrade | +1 |
| Completed day | +4+L |
| Raid won | +8+L |
| Long Dusk won | +20+2L |
| Raid lost | +3 |
| Long Dusk lost | +6 |

The XP needed for the next level is round(30·L^1.35).

## Formulas

```
costMul(L)  = 1 + 2.4·L²/(L²+64) + 0.05·L      // Hill/sigmoid: steep early, flattens, peak keeps rising slowly
cost(type,n,L) = round(base · (1 + 0.45n) · costMul(L))
limit       = round(45 · costMul(L) · tierLoanScale · (Exchange ? 1.15+0.01n : 1))
food    = (8 + Σ field 10+7n) · (lean ? 0.75 : 1) · (Crop rotation ? 1.15 : 1)
housing = 6 + Σ cottage 6+2n + Lantern 20+6n;   room = min(housing, tier people cap)
income  = (4 + 1.5·√fed + Σ building income · roads(1.05+0.01n)) · (looms ? 1.1 : 1)   (grey buildings = half)
          building income: Clockworks 4+2n, Hourglass 1+0.5n, Lantern 10+3n, Mirror 5+2n, Trade Post 1+0.5n, Academy 2+n
defence = (palisade 6+3n + Σ tower 5+2.5n + Harbour 8+3n + 0.6·√fed (×2 at the walls)) · (crossbows ? 1.12 : 1),
          ×1.3 if the dusk is borrowed (×1.5 with a Harbour)
interest = 25% a night · (Hourglass ½) · (generous 0.6) · (Ledgers 0.8) · (Exchange 0.7−0.01n)
morning bonus = 0.3·income;  people move halfway toward min(room, food) each morning (founders: at most 8 a day)
```

People use square roots on purpose: a City of 1,600 is not 40× a Colony of 41 in income or defence. Buildings carry the scale.

Base costs:

| Building | Base cost | Building | Base cost |
|---|---|---|---|
| Field | 6 | Roads | 12 |
| Cottage | 7 | Trade Post | 14 |
| Clockworks | 10 | Academy | 20 (techs 40–50 × cost) |
| Watchtower | 9 | Hospital | 16 |
| Hourglass | 8 | Exchange | 30 |
| Palisade | 8 | Harbour | 26 |
| Lantern Hall | 26 (credit) | Observatory | 30 |
| Sun Mirror | 34 (credit) | | |

### Level vs cost vs income vs time-to-next-level

The cost columns are computed. The credit limit is shown for the tier you are usually in at that level. The income and days columns are measured from the balanced bot in `sim-test.js` (mean over 24 campaigns).

| Level | Cost × | Clockworks build | Upgrade to level 5 (Hourglass) | Credit limit | Income/day (sim) | Days to next level (sim) | Reached on day |
|---|---|---|---|---|---|---|---|
| 1 | 1.09 | 11 | 28 | 59 (Colony) | 8 | 3.5 | 0 |
| 2 | 1.24 | 12 | 32 | 67 | 19 | 4.3 | 4 |
| 3 | 1.45 | 14 | 38 | 78 | 23 | 8.4 | 8 |
| 4 | 1.68 | 17 | 44 | 95 (Village) | 29 | 10.1 | 16 |
| 6 | 2.16 | 22 | 56 | 122 | 77 | 15.5 | 39 |
| 8 | 2.60 | 26 | 68 | 234 (Town) | 111 | 18.5 | 72 |
| 10 | 2.96 | 30 | 77 | 267 | 214 | 23.3 | 112 |
| 12 | 3.26 | 33 | 85 | 411 (City) | 278 | 23 | 161 |
| 14 | 3.51 | 35 | 91 | 442 | 417 | 29.5 | 211 |
| 16 | 3.72 | 37 | 97 | 469 | – | – | – |
| 20 | 4.07 | 41 | 106 | 513 | – | – | – |

What the curve does:

- **Costs** rise fast to about level 8 (×2.6), then flatten. From L12 to L20 they rise only another 25%.
- **Credit** jumps at each tier (loan scale ×1.2 → ×1.25 → ×2 → ×2.8, plus the Exchange), because a bigger settlement has more to borrow against and more to buy.
- **Income** keeps compounding: about 50× from L1 to L14 while costs grow 3.2×. Building counts and level caps grow per tier (City allows 40 cottages to level 20), so the extra Hours have somewhere to go.
- **Time to next level** grows steadily: 3.5 → 4.3 → 8.4 → 10.1 → 12.3 → 15.5 → 18.1 → 18.5 → 21.1 → 23.3 → 26 → 23 → 27.2 → 29.5 days. No step is more than 2.2× or less than 0.5× the previous one (checked).

## Difficulty curve (raid strength vs level)

Raiders come for what you hold:

```
wealth = Hours held + caravan at sea + Σ invested in buildings, wall and roads
w      = (wealth / costMul(L)) ^ 0.63
ramp(L) = 0.68 + 0.42·L²/(L²+16) + 0.01·L      // long gentle slope, steeper only near the top
raid day 2 = (0.45·w + 5) · ramp · tierRaidScale · events · breather
raid day 4 = (0.65·w + 7) · ramp · tierRaidScale · events · breather
Long Dusk  = (0.78·w + 8 + 0.55·dawnDebt/costMul) · ramp · tierRaidScale · events
             dawnDebt = max(debt now, debt at dawn on day 6); ×(0.6−0.01n) with an Observatory
actual strength = nominal × (0.85…1.15); shown as a ±25% range (Observatory ±10%) plus a light/even/heavy band, never the exact roll
breather: after a lost raid, or after any Long Dusk, the next raid is ×0.8
lost raid: ceil(f·(4+2·tier)) hits (+1 with Roads, −1 with a Hospital); people lost = ceil(f·8%·pop), ×2 at the walls, ×2 to the Long Dusk
```

| Level range | ramp | Raid scale | What it feels like | Typical time costs |
|---|---|---|---|---|
| 1–3 (Colony) | 0.71–0.86 | ×1 | Gentle. A Watchtower plus a staked wall holds most raids; the boss is beatable without debt. | Builds 7–15 h, limit 59–78 |
| 4–7 (Village) | 0.93–1.07 | ×0.95 | The long "solvable but challenging" stretch. Roads and caravans make Hours; a borrowed dusk sometimes tips a raid. | Builds 10–24 h, limit 95–134 |
| 8–11 (Town) | 1.10–1.16 | ×1.08 | Harder. Raids track wealth; research is the good loan, the Hospital softens a loss. | Builds 16–31 h, limit 234–281 |
| 12+ (City) | 1.18–1.28 | ×1.22 | Hard. Every season is a real fight; never-borrowing loses the Long Dusk almost every time. | Builds 20–41 h, limit 411–513 |

Spikes and breathers:

- Raid day 4 is about 45% stronger than day 2, and the Long Dusk about 70% stronger.
- A loss gives you a ×0.8 breather on the next raid, and every boss is followed by one.
- A level-0 building can only be destroyed by the boss. Ordinary raids knock levels off and steal Hours, so a bad night stings without spiralling.

**Target season-win bands** are measured as the Long Dusk win rate of the mean of the never, balanced and leverage bots. Sim results come from 24 colonies × 45 seasons each (1,080 seasons per strategy), starting from empty land. Every bot builds the tier unlocks; borrowing bots (credit ≥ 0.8) also borrow to fund research and to send caravans when the price is ≥ 1.35. Cells are boss win rate / growth per season.

| Tier | Target band | Competent mean | never | balanced | leverage | borrowMax | reckless |
|---|---|---|---|---|---|---|---|
| Colony | 65–95% | **71%** | 87% / 85 | 68% / 111 | 60% / 121 | 0%, never leaves Colony | 0%, never leaves Colony |
| Village | 55–85% | **76%** | 63% / 161 | 78% / 265 | 86% / 262 | – | – |
| Town | 45–75% | **64%** | 47% / 296 | 75% / 552 | 70% / 561 | – | – |
| City | 35–65% | **49%** | 5% / 429 | 71% / 886 | 72% / 851 | – | – |

Growth is net worth per season divided by the cost multiplier, so growth figures are comparable across levels. **All checks pass** (`node sim-test.js`, about 3.5 min) on the current prototype rules:

- Every tier is inside its band. (Village sits above Colony: the founders' first seasons are the hardest per Hour you own.)
- At no tier is one strategy best at both survival and growth: Colony never-borrow survives best and leverage grows fastest; Village leverage survives best and balanced grows fastest; Town balanced survives best and leverage grows fastest; City leverage survives best and balanced grows fastest. **The Village and City margins are thin** (growth 265 vs 262, win 72% vs 71%). A larger sample (`RUNS=36`) flips both: Village leverage becomes best at both (82% / 262 vs balanced 72% / 255) and City balanced edges it (74% / 884 vs leverage 73% / 852). Every other gate still passes at 36. Balanced and leverage converge once income dwarfs the loans; widening that gap is the first balance job in the build (known issue, `FINAL_PLAN.md` section 13).
- Borrowing changes the outcome at every tier: +42% to +107% growth and +23 to +66 points of win rate versus never-borrow. It matters more late, not less.
- borrowMax and reckless lose. They default, get seized (1.5–2 buildings a season) and never reach the Village: in the prototype, a seizure in the season blocks the tier-up. The build removes that rule (no lore), so this gate needs a lore-backed replacement (see the audit).
- Time-to-next-level is smooth.

What it took (this round): the clean-season tier rule (stops lucky over-borrowers from growing; prototype only, removed for the build because it has no lore reason), Hesper's ledger closing at dawn on day 6, caravan payouts at 0.75–1.05× the price (break-even near price 1.1, so blind trading loses), and per-tier loan and raid scales (above).

Run it yourself: `node sim-test.js` (`RUNS`/`SEAS` env to change the sample).

## v1 VERDICT fixes, now in

- Borrowing changes the length of the day. You see the HUD day length go from 13h to 16h, then 8h tomorrow.
- Grey land is the sea-facing land. Raiders land there and hit it first; the headless run shows a grey cottage damaged before any non-grey building.
- A decision at every raid dusk (the three options above).
- Credit-only buildings: Lantern Hall and Sun Mirror.
- Default seizes a building ("Gently, as always."), and the run continues.
- Random season events.

## Honest risk check: is this turning into a Clash clone?

Yes, in places. The isometric grid, tier gates, per-type building caps, upgrade levels and stage art are all straight from the Clash/village-builder playbook. Upgrade-grinding could easily become the game, with borrowing sliding into a side menu. The specific risks:

1. **Upgrade loops crowd out the loan decision.** Late on, income is high enough that a player might never need the Clockkeeper. The sim says that player falls far behind (never-borrow wins 5% at City against 71% for balanced), and every tier unlock is built around a loan decision, so borrowing stays in the main loop. Mitigations already in: the credit limit grows with level, credit-only buildings exist, the dusk loan, and wealth-scaled raids.
2. **Tier caps feel like timers.** "Reach level 8 and 120 people" is a Clash-style gate. It is softened because population comes from food and housing (choices), not a clock, but there are no real-time timers yet. **There should never be real-time build timers.** Time is the currency; waiting would make it a tax.
3. **Raids are spectacle, not play.** The only raid interaction is the dusk decision. That keeps the focus on debt, which is good, but the raid itself is a cutscene.
4. **The palisade ring is a pure power upgrade.** It does not interact with grey land yet. A good next step: grey land outside the gate side of the ring, or let the Clockkeeper repossess wall segments.
5. **City-scale readability.** A 21×21 City fits a phone at zoom 0.33: buildings read as a skyline, not as tappable lots. Tap-to-zoom, pinch and the ⤢ fit button make it workable in headless tests; big looks spread to 2×2/3×3 and grey hatching stays visible, but it needs a real device. The crowd clusters read as overcrowded in play; the build replaces them (people on screen, above).

What still keeps it from being Clash:

- The resource is daylight itself.
- The debt literally greys your map and decides where raiders land.
- Every raid asks whether to borrow more.
- Losing means repossession, not a reset.
- The boss is sized by what you owe.

## Lore reasons for every rule (audit for the build)
Lore drives gameplay: every rule needs a story reason. ✔ = has a reason; ✎ = reason added now; ✖ = removed or replaced.

| Rule | Lore reason | Status |
|---|---|---|
| Hours are both money and daylight | The island keeps light like a cistern keeps rain; a day's work leaves Hours behind | ✔ |
| A loan lengthens today and shortens tomorrow | Hesper lends tomorrow's light | ✔ |
| Grey land, half output, front lots first | Lent land's hours are working elsewhere; the shore goes first | ✔ |
| Raiders land on grey land first | The Late come from islands that went fully grey; thin, lent time is where they can step ashore | ✎ |
| Interest every night | Hesper visits at dusk with her ledger, "adding a little more" | ✔ |
| The Hourglass halves interest | Aster taught us to keep our own count, and Hesper respects a kept count: she can't round up what you've measured | ✎ |
| Default seizes a building, and the run continues | "Gently, as always." She takes the thing, never the people | ✔ |
| Lantern Hall and Sun Mirror only on credit | They run on Hesper's lamps and Hesper's light: she sells them, never gives them | ✎ |
| Borrow the dusk: +30% defence | More light means less dusk, and the Late only exist at dusk | ✎ |
| Everyone to the walls | People are the colony's last defence | ✔ |
| The Long Dusk grows with debt | The shadow of everything owed | ✔ |
| The ledger closes at dawn on day 6 | Hesper reads her ledger to the Long Dusk at sunrise on the last day | ✎ |
| Raids scale with wealth | They want hours, not blood | ✔ |
| Breathers after a loss or a Long Dusk | The Late took what they came for; the Long Dusk sinks back "like it was patient" | ✔ |
| Season events | Weather, harvest, Hesper's moods, red sails | ✔ |
| Player level and XP | Time lived and learned: days survived, raids held | ✎ |
| Level cap per tier | **What the current age knows how to build**: no clock towers in a frontier age | ✎ |
| Costs rise with level | Finer crafts take more hours | ✎ |
| Credit grows with level and tier | Hesper lends against what you have; a bigger island is better collateral | ✎ |
| Founders arrive over the first days (at most 8 a day) | Nell ferrying the *Patience* back and forth | ✔ |
| People cap and land per tier | What the shore can hold until the next overflow | ✔ |
| **Tier growth: level + people** | The kept years overflow into the island and it wakes an age later (`LORE.md`, "Why time moves on") | ✎ |
| Can't grow while over the credit limit | Lent hours aren't kept, so a fully lent island has no time to spend | ✎ (build) |
| **Growth only after a won Long Dusk with no seizure** | No genuine reason found; it was a balance patch against borrowMax | ✖ **removed** |
| Homes on grey land house half; the homeless leave at dawn | People won't sleep where the hours have gone | ✎ (build, sim-tested: not enough alone) |
| Hesper's seal: no growth for 12 days after a seizure | The dial won't overflow into an island under her seal | ✎ (build: borrowMax 0/12 reach Village) |
| Buildings keep a little income; upgrades give 1 + stage XP | Every roof keeps an hour; bigger works keep more of the year | ✎ (build) |
| Salvage ×1.5 when borrowing the dusk; a boat per held night | The Late drop what they carry; in borrowed light we find more | ✎ (build) |
| Raid levels rebuild at half price | The Late take hours, not timber | ✎ (build) |
| Great Dial (City, own Hours only) | The city builds its own dial to keep time without Hesper | ✎ (build) |
| Tier unlocks (Roads, Trade Post, Academy, Hospital, Exchange, Harbour, Observatory) | Each has its beat in `LORE.md` | ✔ |
| Only quiet nights are announced | The watchtower can vouch for an empty horizon, not for what's beyond it | ✎ (build) |
| Raid nights give a cryptic kind-and-power hint | Gulls, oars and drums carry before the boats do | ✎ (build) |
| The Long Dusk is always day 6 | The season's end is the one appointment the Late keep | ✎ |
| Observatory sharpens hints, never forecasts | Ada can count oars, not intentions | ✎ (build, replaces exact forecast) |
| People produce only in job slots | The dial pays for work, not for presence | ✎ (build) |
| Defence from staffed posts | People are the colony's last defence | ✎ (build) |
| Hunger: idle on day 1, families leave from day 3 | They row back toward the lights on the horizon | ✎ (build) |
| No game over: the newest district goes dark | The first six never leave the dial | ✎ (build) |
| Roads cut walking time | Work moves along the hour-lines | ✎ (build) |
| Trade Post food imports | Other dials sell grain by the tide | ✎ (build) |
| Hospital returns the wounded; plague events | The Stitch | ✎ (build) |
| Later tiers are slower, not harder | Each age keeps more time, and takes longer to fill | ✎ |
| Caravan prices change | Tides and trade between dials | ✔ |
| Research finishes overnight | Ada studies at night | ✔ |
| First Long Dusk weaker | It feeds on what's owed, and a new colony hasn't owed much: "It hadn't learned our names yet." | ✎ (build) |
| New-shore breather | The Late don't know the new shore yet | ✎ (build) |
| Pity after 2 lost Long Dusks | It fed well and is sated; Hesper wants you solvent (trust) | ✎ (build) |
| Bigger morning bonus when behind | No reason | ✖ replaced by a supply boat from another dial (the lights on the horizon) |

## Playtest feedback (v2, Chigozie): what changes in the build
The core loop plays very well. Four problems, with the fixes designed in `FINAL_PLAN.md` (sections 2, 3, 11–13). None of them are in the prototype yet; `sim-test.js` now models the build rules (`RULES=build`, default; `RULES=proto` runs the prototype as shipped) and adds two pacing gates.

1. **People are overcrowded.** Replace the crowd clusters with sampled figures that have jobs, capped per tier and per quality setting (see "People on screen" above).
2. **Every tier looks the same.** Each tier becomes an era, because time itself moves on as the island grows: Colony is wreck and frontier (timber and canvas), Village is hearth and harvest (early medieval farming), Town is gears and gilt (Renaissance clockwork), City is brass and steam (the Meridian age). Each era has its own palette, materials, silhouettes, music and UI frame; the look progression stays inside the era. Full art direction in `FINAL_PLAN.md` section 11 and the era beats in `LORE.md`.
3. **Progress stalls at Village, and the early curve is too hard.** In the latest sim run the balanced bot spends about 3.9 seasons in the Colony and about 9.7 in the Village. **Cause confirmed:** flat income plus strong-dusk defensive borrowing (Hours went to walls and repayments, so days passed with no felt gain). The fix (small income per action, telegraph, raid cap vs income, defended-night rewards, half-price rebuilds, Great Dial, tier levels 3/7/11) and the gate status are in `FINAL_PLAN.md` section 3, "Plateau fix". Secondary causes, each paired with a fix, are listed in `FINAL_PLAN.md` section 3 (Town gate distance, the cost spike between levels 4 and 8, few visible rewards, no visible next goal, wealth-scaled raids, housing/food busywork, interest that makes borrowing feel bad, real-time pacing, season sameness), with questions for him. Player-time targets: **Village in 10–15 minutes of the first session, Town within the first few days.**
4. **Nothing makes the colony yours.** Name and crest, a founder you name, named villagers with three-beat stories, Hesper with a trust ledger, lore delivered through play (letters, named raid captains, discoveries), and a chronicle that records the colony's history. Copy stays one line per beat, with at most one pun per screen.

5. **Second round (Chigozie):** raids are a surprise (only quiet nights announced, cryptic hints, Observatory sharpens them); people need jobs, posts and food with real hunger; every tier system has a clear mechanic (table above); figures keep a home-work schedule; later tiers are slower, not harder (tier-scaled pacing gate 2/3/3/4 days). Balance-affecting parts are listed as Phase 1 tuning work in `FINAL_PLAN.md` section 3.

Also planned, not Phase 1: the async multiplayer roadmap (more colonies per player, sea exploration, alliances, trading, raiding other players on a tick-based server; `FINAL_PLAN.md` section 12).

## Not verified / limits of this prototype

- Real-phone feel, frame rate, iOS Safari, sound and haptics are untested. Headless Chromium only (software rendering), phone at 390×844 with touch. Full-density City measured 58–60 fps: desktop DPR 2 at 9–13 ms CPU per frame, phone at 7–10 ms. The desktop raid dips to 58 fps.
- City readability: at fit zoom (0.33) the City reads as a skyline; individual lots need a tap-to-zoom first. Not checked on a real phone.
- Small HUD text (11px logical, about 8pt on a 393-wide phone) may be too small.
- Human win rates and fun are unknown. The bands are bot results.
- The headless run uses test hooks (`window.__bt`) to grant XP, population and Hours and to skip to dusk, so it can reach Village, Town and City in minutes. That flow is not natural pacing.
- **Known prototype issues for the build:** the day hint can go stale ("Empty land…" was seen at City after injected state, because the hint updates only at day start, on build and on phase changes); the fixed 540×960 canvas letterboxes on a 390×844 phone with mismatched bars; and the balanced vs leverage near-tie at Village and City (above).
- There are no offline accrual, multiplayer or bottle messages yet. They are lore hooks only.
