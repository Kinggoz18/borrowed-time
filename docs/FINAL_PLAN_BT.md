# Borrowed Time: final plan

## 1. Decision summary
- **Build it.** It has the strongest identity of the three games: daylight is the currency, and you can borrow tomorrow's to survive tonight. Debt shows on the map as grey land. Nothing else on the store plays like that.
- **The v2 prototype already includes the v1 VERDICT.md fixes:**
  - a loan lengthens today and shortens tomorrow
  - raiders land on grey land first
  - a decision at every raid dusk
  - some buildings can only be bought on credit
  - default seizes a building instead of ending the run
  - random season events
- **What v2 added** (all in `prototype.html`, rules in `DESIGN_V2.md`):
  - an isometric island that starts empty
  - a palisade you buy that rings the settlement and grows with it
  - buildings that start at level 0 and get a new look every 3 levels (7 looks, cap level 20); late looks spread to 2×2/3×3
  - Colony 7×7 → Village 11×11 → Town 15×15 → City 21×21, gated by player level and population (the prototype also required a won, seizure-free season; **removed for the build: it had no lore reason**)
  - a new **system** at every tier, each tied to borrowing: Roads + Trade Post (Village), Academy + Hospital (Town), Exchange + Harbour + Observatory (City)
  - a time-cost curve that rises, then flattens
- **Playtest of v2 (Chigozie):** the core loop plays very well. Four problems to fix in the build: people on screen are overcrowded; every tier has the same look; progress stalls at Village and the early curve is too hard; and there is little that makes the colony yours. Fixes: people on screen (section 2), eras and art direction (section 11), player-time targets, the confirmed plateau cause (flat income plus strong-dusk defensive borrowing) and its fix (section 3), your colony and your story, and narrative delivery (section 2). The multiplayer roadmap is in section 12, and known prototype issues are in section 13.
- **Lore drives gameplay.** Every rule needs a story reason, or it goes. The audit is in `DESIGN_V2.md` ("Lore reasons for every rule"); rules without a reason are removed or replaced there.
- **The guard rail:** borrowing must stay the core decision at every tier. It's enforced as CI sim gates (section 6), not good intentions. This is what stops it turning into a Clash clone (section 9).
- **Build:** the same web stack as One Spark and Loom Rush (TypeScript + Vite + PixiJS v8 + Capacitor), Android first, then iOS. It uses the shared `kit/` folder.
- **The stack has to earn it first: a hard performance gate (Phase 0, section 5).** Before any real game code, a City-tier stress scene must hold up on a cheap/mid Android phone. **If it fails, Borrowed Time switches to Unity before game code is written.**
- **Pizzazz first:** the vertical slice ships the top 3 ad moments (section 4). We test real clips before full production.
- **Every number in this plan is a starting target** taken from the prototype and its bot sim. Player data replaces it once we have it.

## 2. The game
**One line:** settle an empty island that keeps its own time, borrow daylight from a polite lender to grow faster, and survive the dusk when the people who borrowed too much come rowing.

| Rules | |
|---|---|
| Island | An isometric sundial island. The gnomon's shadow is the clock. It starts **empty**: no buildings, no wall, 8 Hours, 6 people. The rest of the 41 founders come ashore over the first days. |
| Hours | Money and daylight at once. Income is paid each in-game hour. Seasons are 6 days: two raids fall on unannounced nights (days 2–5, never two nights running), and the Long Dusk boss always comes on day 6. Only quiet nights are announced (section 3, "Raids are a surprise"). |
| Borrowing | From Hesper, the Clockkeeper. A big enough loan **adds light today and takes it off tomorrow** (up to ±3h). Your credit limit grows with your level. |
| Grey land | Debt ÷ limit is the share of your lots that turn grey, sea-facing lots first. Grey buildings produce half, and **raiders hit them first**. |
| Interest | 25% a night (starting target). The Hourglass building halves it, and the "generous Keeper" season lowers it. |
| Default | If you owe more than your limit at night, Hesper **seizes your most-invested building, grey land first**, and writes part of its value off your debt. The run continues. |
| Credit-only buildings | Lantern Hall (Village+) and Sun Mirror (Town+, +1h of daylight). Risky debt becomes a strategy, not a trap. |
| Dusk decision | **Hold the line** · **Borrow the dusk** (a loan, +30% defence, tomorrow 1h shorter) · **Everyone to the walls** (villagers fight fully, but you lose twice as many if the wall breaks, and get no morning bonus). |
| Long Dusk | The season boss. Its strength includes what you owe; Hesper's ledger closes at dawn on day 6, so repay by the night before. |
| Tier systems | One new building and effect per tier unlock, each a different way to use or survive debt (table below). |
| Season events | Fair winds, Long summer (+1h of light), Lean harvest (food −25%), Generous Keeper (lower interest), Red sails (stronger raids). |

**Buildings.** Everything bought from Build starts at **level 0** and upgrades to a cap of 20. **Every 3 levels it gets a new look: 7 looks per type** (`rough, settled, timber, sturdy, stone, fine, grand`), all drawn in the prototype for 13 building types (full table in `DESIGN_V2.md`). From look 5 (level 12) most buildings take a 2×2 block and at look 7 (level 18) a 3×3, if the lots behind them are free; otherwise they just grow taller. From Town up, neighbouring cottages merge into terraces and dense street blocks.

| Building | rough (0+) | settled (3+) | timber (6+) | sturdy (9+) | stone (12+) | fine (15+) | grand (18+) |
|---|---|---|---|---|---|---|---|
| Field | Sprouts | Fenced plot | Fenced wheat | Scarecrow | Shed 2×2 | Barn 2×2 | Windmill farm 3×3 |
| Cottage | Tent | Lean-to | Thatched hut | Timber house | Stone house | Townhouse | Tall townhouse (merges into blocks) |
| Clockworks | Bench | Shed | Workshop | Brick works | Clock works 2×2 | Twin chimneys 2×2 | Clock-tower factory 3×3 |
| Watchtower | Stilts | Log tower | Timber tower | Roofed tower | Stone tower | Spire 2×2 | Fortified keep 2×2 |
| Hourglass / Lantern Hall / Sun Mirror | Crate / tent / A-frame | … | … | … | Rotunda / stone hall / array (2×2) | … | Golden dome / grand hall / beam tower (3×3) |
| Unlocks (Trade Post, Academy, Hospital, Exchange, Harbour, Observatory) | Crates, slate, cross-tent, desk, jetty, telescope | … | … | … | 2×2 halls, lighthouse, dome | … | Guild hall, domed academy, great hospital, temple of credit, flagship dock, great dome (3×3) |
| **Palisade (7 stages)** | Stakes | Woven stakes | Log wall | Log wall with walk | Stone | Stone with towers | Fortified, gatehouses and flags |

**The palisade.** You buy it from Build; it takes no lot. It appears as a **ring around the settlement perimeter**, with segments, gates and corner posts. When the settlement reaches a new tier, the ring **re-fits** the bigger perimeter. Upgrades raise the whole ring through 7 stages. Lost raids can knock it down a level.

**Settlement tiers.** *Lore reason:* the dial keeps time like a cistern keeps rain. When a colony has **kept** enough of its own time (lived enough, which is player level, and is big enough to hold it, which is people), the kept years overflow into the island overnight: new shore surfaces and the age moves on (`LORE.md`, "Why time moves on").
- **The build's gate:** player level + people, and **not over your credit limit**. Hours lent to Hesper are not kept, so a fully lent island has no time of its own to spend.
- **Removed:** the prototype's "only after a won Long Dusk with no seizure" gate. It had no lore reason. It was also not the cause of the Village plateau (per Chigozie).
- **borrowMax stop (sim-tested, build rules):** grey-land homes house half, and the homeless leave at dawn like the hungry do ("people won't sleep where the hours have gone"). Alone it did **not** stop borrowMax (9/12 colonies still reached Village). Added **Hesper's seal**: after she seizes a building, her seal sits on the island for 12 days (two seasons) and the dial won't overflow under it. With both: borrowMax reached Village 0/12, balanced and leverage unchanged (12/12, Village around day 14). No won-Long-Dusk requirement.

Each tier-up shows a card listing what's new, plus one lore beat.

| Tier | Level | People to reach | Land | People cap | Level cap | Loan scale | Raid scale | New system (each touches borrowing) |
|---|---|---|---|---|---|---|---|---|
| Colony | 1 | – | 7×7 | 41 | 5 | ×1.2 | ×1 | The basics: Field, Cottage, Clockworks, Watchtower, Hourglass, Palisade |
| Village | 4 | 36 | 11×11 | 160 | 11 | ×1.25 | ×0.95 | **Roads** (+Hours, but raiders run them: +1 hit when you lose) · **Trade Post** (stake Hours, even borrowed ones, on tomorrow's caravan price) · Lantern Hall (credit) |
| Town | 8 | 120 | 15×15 | 500 | 17 | ×2 | ×1.08 | **Academy** (research paid up front: the good loan) · **Hospital** (survive a lost raid while in debt) · Sun Mirror (credit) |
| City | 12 | 380 | 21×21 | 1,600 | 20 | ×2.8 | ×1.22 | **Exchange** (refinance: cheaper, bigger credit) · **Harbour** (borrowing the dusk gives ×1.5) · **Observatory** (sharper dusk hints: names the raid and a ±10% range; the Long Dusk feeds on less debt) |

Building counts per tier (Colony/Village/Town/City): Field 3/5/8/12, Cottage 4/10/20/40, Clockworks and Watchtower 2/4/7/10, one each of the rest once unlocked.

**Player XP:**

| Source | XP |
|---|---|
| Build | +2 |
| Upgrade | +1 |
| Completed day | +4+L |
| Raid won | +8+L |
| Long Dusk won | +20+2L |
| Raid lost | +3 |
| Long Dusk lost | +6 |

The XP needed for level L is 30·L^1.35. Every tier-up plays a short lore beat.

**City view (from the prototype).**
- 21×21 lots inside the wall, and **drawn outskirts beyond it** that grow per tier (farm plots, huts, windmills, a tree belt, avenues, docks with 1+tier piers and boats). They are not interactive; they sell the scale.
- The camera auto-fits each tier: zoom about 0.75 Colony, 0.55 Village, 0.44 Town, 0.33 City. Pinch/wheel zoom, drag to pan, **tap to zoom** when zoomed out below 0.5, and a ⤢ button to re-fit.
- Big looks take 2×2/3×3 and cottages merge into blocks. The prototype's crowd clusters (one per ~35 people, up to 48) **read as overcrowded in play**; the build replaces them with people on screen (below).
- At fit zoom the City reads as a skyline, not as tappable lots; tapping zooms in first. Tap targets ≥ 44 px apply at the zoomed-in level.

**People on screen (replaces the crowd clusters).** The HUD shows the real head count. The map shows a **representative sample**, where every figure is there for a reason. All numbers are starting targets.

| Tier | Visible figures | Cap (high / mid / low quality) |
|---|---|---|
| Colony | 1 per 2 people | 20 / 16 / 12 |
| Village | 1 per 5 | 30 / 22 / 14 |
| Town | 1 per 12 | 40 / 28 / 18 |
| City | 1 per 30 | 50 / 32 / 20 |

- **Every figure is a person with a home and a workplace** (a field, a Clockworks, the Trade Post, a caravan, a wall post). No other roles: "this person works at X". Notables (below) follow the same rules and can be tapped for their line.
- **The day, not wandering** [the dial's shadow is the island's work bell]:
  - Dawn: figures leave home and walk the roads to work.
  - Day: they work at their building (in the field, at the door, on the cart).
  - Dusk: they walk home. Nobody idles in the street.
  - Night: only the watch is out, on staffed posts.
  - Raid: the defenders are on the walls; everyone else is indoors.
- **Spread by assignment:** the sample is drawn per workplace, at most 3 figures per building (6 for a 2×2+, 4 per wall side), so no spot crowds. A district with no jobs is quiet, not empty of homes.
- **States you can read:** hungry people sit idle and greyed at home; wounded ones wear a sling until the Hospital sends them back; grey lots have fewer figures.
- Events change the scene: market day at the Trade Post, a plaza festival after a held Long Dusk.
- **Why the caps:**
  - Each figure is an animated sprite, a depth-sort entry and a path step every frame, which adds overdraw and sort cost on low-end GPUs.
  - Figures must never hide buildings or the grey-land signal.
  - A few people with jobs read better than a crowd.
- **The mechanics behind them** (jobs, staffed posts, food, hunger, leaving): `DESIGN_V2.md`, "People, jobs and food".
  - Raiders are capped separately at 24 / 16 / 12, and boats at 6.

**Your colony, your story.** Copy stays one line per beat, with at most one pun per screen.
- **Name and crest:** you name the colony (with suggestions such as "New Patience" or "Margery's Rest") and build a crest from a shape, a charge (hourglass, goat, sun, anchor, key, gear) and two colours.
  - The crest flies on the palisade gates, the HUD, the Harbour flagship's sail and the chronicle cover.
- **Your founder:** you name one founder (you). They appear in events and the chronicle and never die; at City they become the Elder.
- **Named villagers:** up to 12 notables at a time. Nell, Tobias and Ada are canon; the rest are generated from an Aster name list.
  - Each has a one-line trait and a three-beat arc tied to a building or unlock, for example "Wren mends nets and wants a boat" → Harbour built → "Wren sails the *Nick of Time*".
  - Losses to raids or hunger are named, gently.
- **Hesper as a recurring character:** a **trust ledger** of 0–5 seals. Repaying on time earns seals; a seizure costs one.
  - Seals unlock her lines and one small perk per seal, for example one grace night per season at 3 seals.
  - The perks must pass the sim gates; trust is never something you can buy.
- **Lore through play:**
  - **Bottle letters:** at most one choice event per season.
  - **Named raid captains of the Late:** recurring rivals with a sail mark. Beat one three times and a story beat opens.
  - **Discoveries in the outskirts:** old dial stones unlock lore pages.
  - **Margery sightings.**
- **Chronicle:** an auto-written journal, one dated line per notable event ("Season 4, Day 6: held the Long Dusk against Captain Ilse").
  - It has era chapter headers and your crest on the cover.
  - Each tier-up gives a shareable card.

**Narrative delivery (story through play, never in the way).**
- **Voices:**
  - **Hesper:** lending, debt states and trust.
  - **Named villagers:** firsts, building arcs, tier-ups.
  - **Raid captains of the Late:** only at raid intros and results.
  - **The chronicle narrator:** past tense, only in the chronicle and on the tier card.
- **Format:**
  - 1–2 lines, about 90 characters each.
  - A speaker chip with a portrait at the top edge, never covering the map centre or the buttons.
  - Never blocks input: tap to skip, auto-dismiss after about 4 s.
  - Never shown over a dusk decision, except Hesper's single line inside the card.
- **Triggers only, no idle chatter:**
  - first-time events (first borrow, first grey land, first raid, first seizure, first caravan, first research);
  - tier-ups;
  - raid intros and results;
  - debt states (≥ 80% of the limit, over the limit, repaid to zero);
  - villager arc beats;
  - Hesper's trust seals;
  - a recurring captain.
- **Frequency caps (starting targets):**
  - at most 1 line per 60 s of play and 3 per in-game day;
  - 1 per speaker per day;
  - no line repeats within 5 seasons.
- **Priority:** debt warnings > first-time > tier-up > raid > flavour. Flavour lines are dropped, not queued.
- **Settings:** Story full / light / off. Off keeps only tier cards and warnings, in plain text.
- **Puns:** at most one per screen, never on warnings.

**Sample script** (starting copy):

| Tier | Trigger | Speaker | Line |
|---|---|---|---|
| Colony | First borrow | Hesper | "Tomorrow's light, lent today. Do bring it back." |
| Colony | Founders arrive | Nell | "Second trip. Twelve more, and the goat insisted on the front." |
| Colony | First grey land | Hesper | "The shore is mine for a while. I'll keep it warm." |
| Colony | First raid intro | Captain Fennick | "Evening. We only want the hours. Keep your walls." |
| Colony | First raid held | Tobias | "Held. I'm sitting down. It's free now." |
| Colony | First Long Dusk held | Chronicle | "Season 1 ended with the dusk held and the ledger nearly clean." |
| Village | Age turns | Ada | "We slept one night and woke a century later. Someone built a mill." |
| Village | First caravan | Trader | "Time is money, friend. Out here it's also the exchange rate." |
| Village | Debt ≥ 80% | Hesper | "Nearly all of it is mine now. Gently, but soon." |
| Village | Recurring captain | Captain Ilse | "Third time. You've built walls. I've built patience." |
| Town | First research | Ada | "Give me one night and I'll give you every night after." |
| Town | Hospital saves people | Wren | "A stitch in time. Eleven, actually." |
| Town | Trust seal 3 | Hesper | "You pay on time. Rare. I'll forgive one night a season." |
| City | Age turns | Ada | "Gaslight, trams, a clock on every corner. It looks like Aster." |
| City | (next line) | Tobias | "Then we'd better not run it like Aster." |
| City | Long Dusk held | Chronicle | "It rose the height of everything we owed, and went home hungry." |
| Any | Debt repaid to zero | Hesper | "Paid in full. I'll miss you until tomorrow." |

**First 30 seconds.**
1. Open straight onto the empty island at golden hour: the first six of forty-one founders, one goat, 8 Hours.
2. Hesper's striped tent glows. "We're starving. Borrow 10 Hours?"
3. Tap yes. The day visibly lengthens, two front lots fade to grey, and a ghost finger points at Build.
4. Buy the Palisade and the stake ring snaps around the settlement with a thunk. Then a Field.
5. By about 25 s the sun is low and the first grey sails are on the horizon.

**Why come back tomorrow.**
- **The island grows visibly:** each tier adds land, the ring re-fits, and buildings change looks.
- **Seasons with events:** every season plays differently, and the Long Dusk is a weekly-feeling climax.
- **Offline hours, capped:** the morning bonus becomes a real offline accrual with a cap (starting target: 8 in-game hours). There are never real-time build timers; time is the currency, so waiting would just be a tax.
- **The lore drip:** tier-ups, raid intros and bottle messages wash up. It stays ongoing and unfinished.

**Easter eggs.**
- Margery the goat is never there at dusk. Find her.
- Bottle messages ("don't borrow on the sixth day").
- Lights of other dials on the horizon at night from Town up.
- Hesper's ledger shows other islands' names, some crossed out.

**Lore** (`LORE.md` is the source):
- Who we are: refugees from Aster, the Metered City, where every hour is taxed.
- Why time can be borrowed: the island keeps light like a cistern keeps rain.
- The lender: Hesper takes what's owed "gently, as always".
- The raiders: the Late are colonists whose islands went fully grey. They exist only at dusk and want hours, not blood.
- It's deliberately unfinished, with an open-questions list. In-game copy stays one line per beat.

**Multiplayer-ready, not multiplayer.** Phase 1 builds none of it, but it ships the data shape: `IslandSnapshot`, a pure deterministic `resolveRaid`, a stable `islandId` and an append-only event log. The roadmap and the server design are in section 12.

## 3. Difficulty curve
**Player-time targets come first. Bot win rates only check fairness.** All numbers are starting targets until playtests and telemetry replace them. **Later tiers stretch time, not difficulty:** a 2–3 day stall at Village or City is expected and fine; the raids stay as sharp as they were.

| Milestone | Target | In seasons (6 in-game days each) | Prototype today (balanced bot, from the latest sim run) |
|---|---|---|---|
| Colony → Village | 10–15 min, inside the first session | ≤ 2 | ~3.9 seasons in Colony |
| Village → Town | within the first few days of play (sessions 3–6, about 1–2 h in total) | 4–6 | ~9.7 seasons in Village: **the plateau** |
| Town → City | about week 2 (about 6–10 h in total) | 8–10 | ~14 seasons in Town |
| City | open-ended mastery | – | – |

A first session must show all of these within 15 minutes: borrowing, a raid, a Long Dusk and a tier-up.

**Why v2 stalls at Village: cause confirmed** (Chigozie): **income stopped growing visibly, and strong dusks pulled the Hours into defence and borrow-the-dusk repayments**, so days passed with no felt progress. The causes below are secondary; each is paired with its fix.

| # | Plausible cause | Fix to try if confirmed |
|---|---|---|
| 1 | **The Town gate is far away:** level 8 (levels 4 → 8 take about 56 in-game days for the bot) and 120 people (75% of the 160 cap) | Town at level 7 with 90 people; cheaper XP up to level 7 (22·L^1.35) |
| 2 | **Cost spike against income:** the cost multiplier rises from ×1.68 to ×2.6 between levels 4 and 8 while Village income is still ramping, so each build feels slower | Flatten costMul between levels 4 and 8, or raise Village base income (Roads +%) |
| 3 | **Little visible progress:** the level cap is 11 at Village, so there are only 4 looks, and long stretches without a new look or building type | Mid-tier rewards: a Village landmark at level 6, villager arcs, the chronicle, and look changes that land roughly every session |
| 4 | **No clear next goal:** the prototype only says what's missing on the season-end panel | Always-visible next goal (below) |
| 5 | **Wealth-scaled raids punish growth:** building more draws bigger raids (w^0.63), so growth feels like treading water | Show it ("Raiders follow wealth"); soften Village raid scale or the exponent for the first Village seasons |
| 6 | **Housing and food busywork:** 10 cottages and 5 fields to keep feeding a growing population | Bigger per-building yields at Village, or auto-suggest the next home or field |
| 7 | **Borrowing feels bad:** 25% interest a night (12.5% with the Hourglass) makes loans feel like a trap, so players stop using the core verb | Lower Village interest, or show the cost of a loan before taking it |
| 8 | **Real-time pacing:** a 12h day at 2.4 s an hour plus panels, every day | Faster quiet days, and a clearer "Rest »" for days with nothing to do |
| 9 | **Season sameness:** the same raid–raid–boss rhythm with new numbers | Village events (market day, letters, captains) that change one rule per season |

**Questions for Chigozie:**
- At what level and population did it stall?
- What were you waiting for: Hours, people, levels or raids?
- Did you know what the next tier needed?
- Were you borrowing?

**Early-curve fixes for the build** (independent of the plateau cause; each must keep every sim gate green, be checked in playtests, and have a lore reason, shown in brackets):
1. **Always-visible next goal (the Charter)** [the colony's charter, Ada's list on the wall]: the HUD always shows "Village: Lv 3/3 ✓ · 27/30 people · kept time ✓". Growth happens at the next dawn once everything is met [the overflow comes at dawn, when the dial's shadow returns].
2. **Front-load the wins:**
   - The first Long Dusk is ×0.7 [the Long Dusk is the shadow of what's owed, and a new colony hasn't owed much yet: "It hadn't learned our names yet."].
   - The first raid is winnable with one Watchtower.
   - Every first build of a type gives bonus XP [a chronicle entry: firsts are stories].
3. **New-shore breather:** in the first season after a tier-up, raids are ×0.85 and the Long Dusk ×0.9 [the Late don't know the new shore yet].
4. **Pity:** after 2 lost Long Dusks in a row, the next one is ×0.85 [it fed well and is sated]. Hesper offers one interest-free night [trust: she wants you solvent].
5. **Catch-up:** if a player is 50% over the target time for their tier, a **supply boat from another dial** arrives with Hours and a letter [the lights on the horizon]. This replaces the earlier "bigger morning bonus", which had no reason.
6. **One suggested next action** under the Charter, for example "Build a Cottage: you need 3 more homes".
7. Neither pity nor catch-up can be farmed: borrowMax and reckless must still lose.

**Plateau fix (build rules, in `sim-test.js` with `RULES=build`; all numbers are starting targets).** Strong dusks and the borrow-the-dusk decision stay; the fix is steady small progress around them.
- **Small income per action:** every building keeps 0.25 + 0.2·level Hours a day [walls, roofs and fields each hold a little of the day]. Each build/upgrade shows "+X Hours/day" (typically +0.1–1%, never a jump).
- **Upgrades give 1 + look-stage XP** [bigger works keep more of the year], so levels keep coming late in a tier.
- **Tier levels 3 / 7 / 11** (was 4 / 8 / 12): the tier tails at the people cap were the longest flat stretches.
- **Raids are a surprise** (replaces the earlier "raid shown the evening before" idea): only quiet nights are announced; raid nights give a cryptic hint (below). The borrow-the-dusk decision stays and is now made under uncertainty.
- **Raid cap:** an ordinary raid can grow at most 25% faster than income since the same raid last season. Spikes and the Long Dusk are untouched (±15%).
- **Defended-night rewards:** salvage = 0.12·income + 0.3·raid strength + 2, ×1.5 if you borrowed the dusk [in borrowed light we find more of it]; every held night also leaves a Late boat at the docks (visible; the fleet adds at most +8% income, diminishing).
- **Rebuild at half price** [the Late take hours, not timber]: levels knocked off by raids.
- **City: the Great Dial** [the city builds its own dial so it can keep time without Hesper; she won't lend for it]: open-ended stages, each visible, cost 20·(1+0.03n)·costMul, total income bonus capped at +25%. City raid scale ×1.12 (was ×1.22) for the new income curve.
- **Pacing gates** (balanced bot = reference player): (a) income keeps rising: 6-day growth p5 ≥ 10% / 3% / 1% / 0.5% (Colony/Village/Town/City); (b) a tier-scaled longest wait without an advancement (new building, new look, Great Dial stage, captured boat, level, tier, or income +1% over the last high): **Colony 2, Village 3, Town 3, City 4 in-game days** [later ages stretch time, not danger]. Colony is 2, not 1: it is already the fastest tier, and measured waits there are 1.4–1.7 days.

**Gate status at hand-off (open tuning for Phase 1).** Last full `node sim-test.js` (24×45, slightly earlier build state): PASS all bands, no dominant strategy and borrowing-matters at all four tiers, reckless loses, smooth levels, and all four income gates (p5 28.7% / 6.6% / 4.0% / 1.5%); FAIL borrowMax (14/24 reached Village, fixed since by the seal: 0/12). Final state, 24-seed gap check against the tier-scaled gate: Colony ≤ 2 ✓, Village worst 2.2 ≤ 3 ✓, Town ≤ 2 ≤ 3 ✓, City worst 3.0 ≤ 4 ✓ (the old flat 2-day gate failed Village and City). `sim-test.js` still has the flat 2-day `MAX_GAP`; switching it to per-tier values is Phase 1 work. **Not yet re-run end to end on the final code.**

**Phase 1 tuning work (balance-affecting changes from this round, none simulated yet):**
1. Re-run the full gate suite on the final build rules, then with every item below.
2. Surprise raids: raid nights move within days 2–5, and **bots must decide from the hint band**, not the exact range (the old competent bot prepped from tomorrow's range). Check that borrowing still matters and that the bands hold when the dusk loan is a guess.
3. Observatory: from an exact forecast to a named type and ±10% range. Re-check City bands.
4. People, jobs and food: Hours from staffed slots instead of 1.5·√fed, defence from staffed posts, hunger idle on day 1 and leaving from day 3, abandoned districts.
5. Roads walking-time penalty, Trade Post food imports, Hospital wounded and plague events.
6. Per-tier `MAX_GAP` (2 / 3 / 3 / 4) in `sim-test.js`.

**Raids are a surprise: dusk hints** (starting targets; replaces any "telegraph").
- **Quiet nights are announced** at evening: *"Calm sea."* [the watchtower can vouch for an empty horizon, but not for what's beyond it].
- **Raid nights are not.** Two raids fall on unannounced nights between days 2 and 5, never two nights running. On a raid night the evening gives one cryptic line: the raid's kind and a rough power band, measured against your defence right now. The Long Dusk always comes on day 6 [the season's end is the one appointment the Late keep], but its strength is hinted the same way.
- **Kinds:** *skiffs* steal Hours and hit little; *longboats* knock levels off and burn grey land first. The Long Dusk is both.
- **Bands:** light (below 70% of your defence), even (70–110%), heavy (above 110%). The hint never gives a number.
- **The Observatory sharpens the hint:** it names the kind plainly and shows a ±10% strength range instead of a band [Ada can count oars, not intentions]. It stays a range, never a forecast, and the Long Dusk still feeds on less debt with it.
- **The decision stays:** borrow the dusk, hold, or everyone to the walls, now chosen under uncertainty. A wrong guess costs Hours or a level, never the run.

| Kind | Light | Even | Heavy |
|---|---|---|---|
| Skiffs | "A few oars, far out." | "Gulls gone quiet. Light boats." | "Quick oars, lots of them. They're making good time." |
| Longboats | "One heavy hull, low in the water." | "Gulls gone quiet. Many oars." | "Drums on the water. Too many oars to count." |
| Long Dusk | "The dusk is thin tonight." | "The light is leaving early." | "Every clock on the island has stopped." |
| Quiet night | "Calm sea." · "Calm sea. Nothing out there but tomorrow." | | |

**How we measure it.**
- **Telemetry:** minutes and sessions to each tier (median and interquartile range), seasons per tier, Long Dusk win rate by tier and by season number, how long the Charter stays blocked by each requirement, time between visible rewards (new look, building or story beat), pity triggers, and the tier at the last session (quit point).
- **Playtests:** 5 testers per phase, think-aloud for the first 20 minutes. Record time to Village. Ask "What's your next goal?" (at least 4 of 5 must answer correctly), "What does borrowing cost you?" and "When did it start to feel slow, and why?" (to confirm or rule out the plateau causes above).
- **Sim:** pacing gates are now in `sim-test.js` (see "Plateau fix" below).

Slow rise, a long "solvable but challenging" slope, and only then real difficulty, with a breather after every spike. The rules are evaluated straight from the code, as in the prototype's `sim-test.js`: strategy bots play 24 colonies × 45 seasons each, from empty land (1,080 seasons per strategy).

**Time-cost curve** (rises, then flattens; the peak keeps rising, but slowly):
```
costMul(L) = 1 + 2.4·L²/(L²+64) + 0.05·L
cost(type, n, L) = round(base · (1 + 0.45n) · costMul(L))
limit = round(45 · costMul(L) · tierLoanScale)      // ×1.2 / ×1.25 / ×2 / ×2.8, Exchange ×1.15+
```

| Level | Cost × | Clockworks build | Credit limit (usual tier) | Income/day (sim) | Days to next level (sim) |
|---|---|---|---|---|---|
| 1 | 1.09 | 11 | 59 (Colony) | 8 | 3.5 |
| 2 | 1.24 | 12 | 67 | 19 | 4.3 |
| 4 | 1.68 | 17 | 95 (Village) | 29 | 10.1 |
| 6 | 2.16 | 22 | 122 | 77 | 15.5 |
| 8 | 2.60 | 26 | 234 (Town) | 111 | 18.5 |
| 10 | 2.96 | 30 | 267 | 214 | 23.3 |
| 12 | 3.26 | 33 | 411 (City) | 278 | 23 |
| 14 | 3.51 | 35 | 442 | 417 | 29.5 |
| 20 | 4.07 | 41 | 513 | – | – |

- Costs grow ×2.6 by level 8, then only +25% from level 12 to 20. Credit jumps at each tier.
- Income keeps compounding, and building counts and level caps grow per tier, so progress is paced by XP, population and the tier gates, not by grinding Hours.
- Days to next level grow smoothly (3.5 → 4.3 → 8.4 → 10.1 → 12.3 → 15.5 → 18.1 → 18.5 → 21.1 → 23.3 → 26 → 23 → 27.2 → 29.5). There's no wall and no runaway.

**Raid strength.** Raiders come for what you hold.
```
w = (wealth / costMul(L)) ^ 0.63        wealth = Hours held + caravan + invested
ramp(L) = 0.68 + 0.42·L²/(L²+16) + 0.01·L
day 2 = (0.45w + 5)·ramp·tierRaidScale   day 4 = (0.65w + 7)·ramp·tierRaidScale
Long Dusk = (0.78w + 8 + 0.55·dawnDebt/costMul)·ramp·tierRaidScale     // dawnDebt: owed at dawn on day 6 (or more)
actual strength = nominal × 0.85–1.15; the player sees only a band (light / even / heavy) or, with an Observatory, a ±10% range
```

| Phase | Levels | ramp | Feel | Typical costs |
|---|---|---|---|---|
| Onboarding | 1–3 (Colony) | 0.71–0.86 | A tower and stakes hold most raids, and the boss is beatable without debt | Builds 7–15 h, limit 59–78 |
| Long slope | 4–7 (Village) | 0.93–1.07 | Solvable but challenging: roads and caravans, the occasional borrowed dusk | 10–24 h, limit 95–134 |
| Hard | 8–11 (Town) | 1.10–1.16 | Raids track wealth; research is the good loan; the Hospital softens losses | 16–31 h, limit 234–281 |
| Mastery | 12+ (City) | 1.18–1.28 | Every season is a fight; never-borrowing almost always loses the Long Dusk | 20–41 h, limit 411–513 |

**Spikes and breathers (sawtooth inside each season).**
- Day 4 is about 45% stronger than day 2, and the Long Dusk about 70% stronger.
- **Breather:** after a lost raid, and after every Long Dusk, the next raid is ×0.8.
- A level-0 building can only be destroyed by the boss. Normal raids knock off levels and steal Hours, so a bad night stings without spiralling.
- If nothing is left to seize, debt is capped at the limit and a villager is lost instead of the run.

**Target season-win bands.** These are Long Dusk win rates for the mean of the never-borrow, balanced and leverage bots (all bots build and use the tier systems). Sim results today, from `sim-test.js` (24 colonies × 45 seasons; win rate / growth per season):

| Tier | Band | Competent mean | Never borrow | Balanced | Leverage | Borrow max | Reckless |
|---|---|---|---|---|---|---|---|
| Colony | 65–95% | 71% | 87% / 85 | 68% / 111 | 60% / 121 | 0% | 0% |
| Village | 55–85% | 76% | 63% / 161 | 78% / 265 | 86% / 262 | stuck | stuck |
| Town | 45–75% | 64% | 47% / 296 | 75% / 552 | 70% / 561 | stuck | stuck |
| City | 35–65% | 49% | 5% / 429 | 71% / 886 | 72% / 851 | stuck | stuck |

"Stuck" means the bot defaults, gets seized and never reaches Village. **All gates pass at the standard 24 runs.** Honest caveat: balanced and leverage are within noise of each other at Village and City, and a 36-run sample flips the no-dominant-strategy gate at both. Widening that gap is the first balance task in Phase 1.

**Telemetry (from soft launch, with consent, anonymous).**
- Season win rate per tier.
- Debt-to-limit at dusk.
- Dusk decision mix.
- Seizures per season.
- Days per level.
- Minutes, sessions and seasons to each tier.
- Charter blockers (which requirement is met last).
- Pity and catch-up triggers.
- Quit points (tier at the last session).

Once a tier has 500+ seasons of data, **player data overrides the bots** and the bands are re-set; the shape rules stay. Never tune difficulty to sell anything.

## 4. Pizzazz and ad hooks
| Idea | The 3-second ad moment | Feature that makes it true | Verdict |
|---|---|---|---|
| **Borrow the dusk** | Grey sails close in at sunset. A thumb taps "Borrow the dusk" and the sun is hauled back up over the horizon, the shadows swing back, and the towers light up. | A sun-rewind animation tied to the real dusk loan, the gnomon shadow sweeping back, a +30% defence flare | **Build (#1)** |
| **Colour flood** | A half-grey island. Tap "Repay all" and colour washes back across the land lot by lot, with a chime per lot. | A per-lot grey→colour shader wave ordered by `greyOrder`, plus audio stingers | **Build (#2)** |
| **Hesper collects** | The polite lender lifts your best building off the island with a bow. "Gently, as always." | The seizure animation: the building floats into the tent, the lot greys, and the ledger page turns | **Build (#3)**, the "don't do what he did" fail ad |
| Long Dusk rising | A hooded shadow, sized by your debt, rises behind your city | Boss scaling already in the rules | Folded into #1 |
| Ring snap | The palisade snaps around the island, then re-fits wider at the tier-up | Ring re-fit animation | Retention polish |
| **Era transformation** | The gnomon's shadow spins and the new era washes out from the plaza: canvas becomes thatch, thatch becomes brick, and the palette and music change | A 5–8 s skippable tier-up cinematic that re-skins every building at its current look | **Build** (the tier-up moment; possible ad #4) |
| Long Dusk spectacle | The sky drains, a shadow sized by your debt rises from the sea, and the ring lights up wall by wall | Boss scaling plus a staged sky, silhouette and lighting sequence | Build (folded into #1) |
| City lights | At night the City's windows and gaslit hour-line avenues glow, answered by other dials on the horizon | Window glows and road lamps already in the prototype, plus the horizon lights | Retention polish |
| Colony→City timelapse | Empty land to walled city | Tier growth | Later, and only if #1–#3 underperform. It's the most Clash-like shot, so avoid leading with it |

**Test before full production.**
- Record 15-second clips from the vertical slice: 2–3 cuts each of #1–#3, plus plain gameplay.
- Run a small paid creative test, only with your approval and budget.
- Point traffic at a "coming soon" page or the web demo.
- Compare click-through, cost per install, and whether demo players finish a season.
- Build more of what wins; drop hooks that don't move the numbers.

## 5. Tech stack
| Piece | Choice | Why |
|---|---|---|
| Language/build | TypeScript + Vite | Same as One Spark and Loom Rush. |
| Engine | **PixiJS v8** | Isometric 2.5D sprites, depth sorting, filters (grey/colour-flood shader), ParticleContainer, WebGL/WebGPU. The rules are already pure functions. |
| Tweens/audio | GSAP, Howler.js | Proven and small. The synthesized SFX stay as placeholders. |
| Native wrap | Capacitor 8 (move to 9 once stable, as for One Spark) | One codebase for web, Android and iOS. |
| Plugins | haptics, AdMob (with consent), RevenueCat, preferences, splash, status bar | Same set as the other two games. |
| Web | Free demo and ad landing page | Same build. |

**Shared `kit/` folder** (built once, used by all three games):
- Menus and UI kit (buttons, sheets, panels, toasts, safe areas)
- Versioned save with migrations
- Ads and consent
- IAP
- Test harness (Vitest, Playwright e2e with screenshot overlap checks, a CI runner for bots)
- Platform layer (audio unlock, haptics, quality tiers)

Game-specific: the island renderer, the economy rules, the sim bots.

**When Unity would be the better call:**
- true 3D (a free camera, real lighting on the island)
- big crowds (hundreds of animated villagers and raiders at once)
- heavy physics-driven destruction
- going console or PC first

None of these are in the plan. The 2.5D isometric look, a few dozen units and sprite-based effects fit Pixi, and staying on the shared web stack keeps the kit, the web demo and one toolchain. If a later phase needs any of the above, re-evaluate then. Don't port mid-production.

**Hard performance gate (Phase 0, before real feature work). Fail means Unity.**

Borrowed Time is the heaviest of the three games: a dense isometric city, a raid, particles and full-screen day/night lighting at once. Web-on-Android has to prove it can carry that before we commit.

- **The stress scene (PixiJS v8 + Capacitor APK, no game logic) uses final-weight art, not greybox.** The final art will be much richer than the prototype, so the gate measures the real load. Use a finished art sample, or stand-in textures and atlases at **final resolution, layer count, normal maps/2D lighting, bloom and particle counts**. What it shows:
  - City tier at max density: 21×21 lots built at looks 5–7 (2×2/3×3 footprints, merged cottage blocks), the full 7th-stage palisade ring, drawn outskirts and docks, 48 crowd clusters
  - 50 villagers with jobs and paths, 24 raiders, boats, arrows, and the era transformation cinematic
  - fire on 6 buildings, 300 particles, window glows
  - the grey/colour shader on half the lots
  - the full-screen tint
  - a looping day → dusk → night → dawn cycle, with the camera panning and zooming
  - final-weight effects: normal-mapped 2D lighting with the moving sun plus window/torch point lights, bloom at its final settings, and the final particle counts (no placeholder shortcuts)
- **Target devices:** a cheap/mid Android phone with 3–4 GB RAM, an older Mali (G52/G57-class) or Adreno (610/618-class) GPU, and Android 11+. Also run it on your own phone.
- **Pass (all of these, on the target device):**

| Check | Pass |
|---|---|
| Typical frame rate | 60 fps through the normal day/night loop |
| Worst load (raid at night, fire, max particles, zooming) | Never below a steady 30 fps. Short hitches are logged, but the 1-second average stays ≥ 30. |
| Startup | Under about 3 s from tap to an interactive scene, behind the splash |
| Thermals | No thermal throttling over 10 minutes of continuous worst load: the fps at minute 10 is within 10% of minute 1, and the device doesn't report a throttled state |
| Texture memory | Within the budget below, measured on the device |

- **Texture memory budget (starting targets, measured on the device):** ≤ 128 MB total GPU memory on the high tier and ≤ 80 MB on the low tier. That counts every atlas, normal map and render target (bloom chain at half resolution, lighting buffer, cached building textures). Textures ship as KTX2/Basis (ASTC/ETC2 on device), with PNG only as a fallback.
- **Atlas plan (2048² max, mipmaps only where zoom needs them):**

| Atlas | Contents | Notes |
|---|---|---|
| Buildings, one set per era | Only the looks each era can reach (level caps): Colony 5 types × 2, Village 7 × 4, Town 10 × 6, City 13 × 7, for **189 building frames** plus terrace/block variants | Looks 5–7 use 2×2/3×3 footprints. Load only the current era's set (plus the next during the cinematic). Built from modular kits per era (section 11) |
| Building normals ×2 | Matching normal maps | Same layout as the diffuse atlases |
| Island, palisade, roads (+ normals) | Terrain, shore, grey-land overlay, wall stages per era (2/4/6/7, 19 in total) × segment/gate/corner, road looks per era (4/6/7), outskirts props per era | Ring pieces are reused, so the atlas stays small |
| Units | Villagers in era costume, named notables, raiders and captains, boats, Hesper (never changes era), Margery, with animation frames | One atlas per era, low tier at half resolution |
| FX (1024²) | Fire, smoke, glow, arrows, colour-flood mask | Additive blending, no normals |
| UI | HUD, sheets, icons, fonts | Shared `kit/` skin |

  The low tier drops normal maps and bloom, and loads half-resolution atlases.
- **Re-run the gate whenever the art direction changes:** a new style, extra layers, new lighting or post effects, bigger atlases, or higher particle counts. A failing re-run blocks that art change until it passes, or until we cut weight.
- **Evidence:** an on-screen fps/frame-time overlay, a CSV log of frame times per second, the startup time, a 10-minute run per device, and a short screen recording.
- **Fail = switch Borrowed Time to Unity (2.5D isometric, URP) before writing game code.** The pure TS rules and sim gates are cheap to re-express in C#. The shared `kit/` stays with the web games. We don't patch around a failed gate with more caching.

**Performance notes from the prototype.** Headless Chrome, full-density City (21×21, every building at levels 10–20, 1,600 people, max ring and roads):

| View | Desktop 1440×900 @ DPR 2 | Phone 390×844 touch (DPR capped at 2) |
|---|---|---|
| Fit zoom, day | 59.5 fps (9.2 ms CPU per frame) | 60.0 fps (6.9 ms) |
| Zoomed in | 59.9 fps (12.0 ms) | 59.5 fps (8.6 ms) |
| Raid at dusk, particles | 58.4 fps (13.3 ms) | 60.2 fps (9.7 ms) |

This is software-rendered headless Chrome, not a phone GPU, so treat it as a sanity check; the Phase 0 device gate is the real test. Carry these over as rules:
- **Cache building and wall sprites:** each building or wall piece is rendered once to a texture, shared by every building with the same look, and re-rendered only when its look, the zoom or its light bucket changes. Re-renders are capped per frame (10) and staggered. Glows and smoke are replayed live, with a smoke budget (3 new puffs a frame, 160 live).
- **Bake the static base:** island, outskirts, ground tiles, roads, the back walls and crowd clusters go into one offscreen layer, rebaked only when its content or the view changes; while panning or zooming the old bake is transformed.
- **Cull** everything off screen; cache footprint claims per frame.
- **Static grain:** the paper-grain overlay is composited once (a static layer), never redrawn every frame.
- **Cheap shadows:** no blur shadows on UI or units. Use offset shapes or a baked soft-shadow sprite.
- **No per-frame zoom wobble:** the camera settles and snaps, so caches stay valid.
- **Particles capped:** 300, with radius clamped.
- **Light and tint:** keep the full-screen multiply tint as a single filter pass, and gradients pre-built per light bucket.
- The startup and first-click path stays tiny, and storage access never throws.

**Performance budgets** (starting targets; mid-range Android WebView, your phone as the reference device):

| Budget | Target |
|---|---|
| Frame | **60 fps on mid Android** at City. Rules < 1 ms a frame. Auto-drop to a low tier if frames run long. |
| Rendering | < 60 draw calls (building atlas plus cached textures). Render resolution capped at DPR 2. |
| Units and particles | Visible villagers ≤ 50 / 32 / 20 (high / mid / low quality), raiders ≤ 24 / 16 / 12, boats ≤ 6, ≤ 300 particles (low tier 150) |
| Textures | Atlases ≤ 2048², KTX2/Basis compressed. GPU memory ≤ 128 MB high tier and ≤ 80 MB low tier, including render targets (see the atlas plan in the gate above). |
| Download | JS < 1.5 MB gzipped. Web demo first load < 5 MB. |
| Cold start | < 3 s to playable behind the native splash. Title → game < 200 ms. |
| Input | Tap → highlight < 50 ms. Tap targets ≥ 44 px. |

## 6. Quality
- **Unit tests (Vitest, fixed seeds):**
  - cost and limit curves
  - borrow daylight (today+, tomorrow−)
  - grey lots in front-first order
  - grey half output
  - interest and the Hourglass
  - default seizure order (grey first, most invested)
  - nothing-to-seize fallback
  - credit-only purchase and headroom
  - tier gates (build: level, people, not over the credit limit; the lore-backed borrowMax stop, e.g. grey homes house half)
  - pity, catch-up and new-shore breathers
  - visible-figure sampling and caps per quality tier
  - the dawn ledger (the Long Dusk uses the debt at dawn on day 6, or more)
  - each tier system: road income and +1 hit, caravan payout, research cost and effects, hospital saves, exchange refinance, harbour dusk ×1.5, observatory hint range and debt weight, dusk hint bands, hunger and leaving timers, staffed slots and posts
  - footprint claims (2×2/3×3 only into free lots behind)
  - building caps and counts
  - palisade ring re-fit per tier
  - all 3 dusk decisions
  - raid damage order (grey first, level-0 only by the boss)
  - breathers
  - events
  - XP and level-ups
  - save migrations
- **Sim gates in CI** (ported `sim-test.js`: never borrow, balanced, leverage, borrow max, reckless; 1,000+ seasons each). **The build fails** if any of these is false:

| Gate | Threshold (starting target) |
|---|---|
| Season-win bands | The competent mean is inside its tier band (section 3); the target bands descend Colony → City |
| No dominant strategy | At every tier, no single strategy is best at both boss wins and growth |
| **Borrowing matters at every tier** | Some borrowing strategy beats never-borrow by ≥ 10% growth or ≥ 8 points of win rate, at every tier including City |
| Greed loses | Borrow max and reckless: boss wins < 10% and they don't reach Village |
| Smooth levelling | Each level's days-to-next is 0.5–2.2× the previous level's. No wall, no runaway. |
| Breathers | The raid after a loss or a boss is weaker than it would have been without the breather |
| Pacing (new) | The balanced bot's seasons per tier stay inside the player-time targets (section 3) |

- **E2E (Playwright, real clicks, desktop DPR 1 and 2, phone touch):**
  - empty land → buy palisade → ring appears
  - build, upgrade, a look change
  - Trade Post caravan, Academy research, Roads
  - tap-to-zoom, pinch, pan and the fit button at Town/City
  - borrow (day length changes)
  - a raid with each decision
  - a lost raid hitting grey first
  - a default seizure
  - a level-up
  - tier-up card with the ring re-fit and the new-systems list
  - Continue from a save, including a stale save, and with storage blocked
  - screenshot overlap checks
- **Device checklist (you):**
  - 60 fps at City on your phone
  - tap accuracy at City
  - readable HUD
  - sound and haptics
  - notch
  - background/resume
  - a cheap phone
- **Loop for every chunk:** plan → implement → tests → review (diff plus screenshots) → plain commit.

## 7. Phases and gates
| Phase | Size | Done when (evidence) |
|---|---|---|
| **0. Performance gate** | S | The section 5 stress scene, with **final-weight art** (finished sample or stand-ins at final resolution, layers, normal maps/2D lighting, bloom and particles), runs as an APK on a 3–4 GB, Mali-G52/Adreno-610-class phone and on your phone. It passes all four checks (60 fps typical, ≥ 30 fps steady at worst load, startup under about 3 s, no throttling over 10 min), and stays within the texture memory budget. Frame-time CSVs and a recording are in hand. **No game code until this passes. Fail = switch to Unity.** Re-run it whenever the art direction changes. |
| **1. Core + greybox** | M | TS rules at parity with `prototype.html` v2, with all section 6 sim gates green in CI. The Pixi isometric greybox plays empty land → Village end to end: ring, upgrades, borrow, dusk decisions, seizure. `IslandSnapshot`, `resolveRaid` and the event log are in place, local only. A 60 fps APK on your phone. |
| **2. Vertical slice** | L | All 4 tiers and their 7 tier systems, with City using 2×2/3×3 footprints, merged blocks, outskirts and zoom. Art direction per section 11: the Colony and Village eras fully, Town and City at greybox+, and the era transformation cinematic. People on screen, the Charter, naming, the crest, notables, Hesper's trust and the chronicle. A tester reaches Village in 10–15 min. Lore beats wired. Pizzazz #1–#3. Offline-hours cap. 5 testers play 20 minutes without help and can say what borrowing costs. Ad clips recorded. |
| **3. Ad creative test** | S | Results in hand and a go / no-go on the hook. Budget only with your approval. |
| **4. Android soft launch** | M | Telemetry (section 3), ads, IAP and consent live. Bands re-checked against player data. Crash-free sessions tracked. Day-1 and Day-7 retention measured, with targets set from the data. |
| **5. iOS** | M | Passes App Store review (4.2, ATT, IAP). Parity with Android. |
| Later | – | Multiplayer roadmap (section 12), only if retention justifies it. The data is ready from Phase 1. |

## 8. Monetization without traps
- **Never sell Hours, loans or debt forgiveness.** Time is the core decision. Paying out of debt would delete the game.
- **No real-time build timers and no energy**, so there's nothing to skip.
- **Cosmetics:** island themes, building skin sets per stage, palisade styles, Hesper tent and lantern sets, an optional cosmetic season pass.
- **Rewarded ads, opt-in only:**
  - an extra bottle message or lore page
  - a cosmetic
  - doubling the capped offline bonus once a day (small, and never offered during a dusk decision or at a seizure)
- **Interstitials:** only between seasons, rarely, none in the first seasons.
- **Remove ads** as a one-time purchase.
- **No traps:** every season is beatable without paying, no loot boxes, clear prices, and no pressure prompts at moments of loss.

## 9. Risks
| Risk | Mitigation |
|---|---|
| **It turns into a generic Clash clone** (grid, tiers, upgrade grind) | The "borrowing matters at every tier" CI gate. Daylight is the currency. Debt greys your map and decides where raiders land. Every raid asks whether to borrow. Default means repossession, not reset. The boss scales with debt. No build timers. Lead ads with #1–#3, never the timelapse. Playtest question: "what does borrowing cost you?" |
| Late-game borrowing goes irrelevant | The credit limit scales with level, credit-only buildings unlock per tier, raids scale with wealth. Watch the sim gate and the telemetry for debt-to-limit at dusk. |
| City view crowded on phones | 2×2/3×3 late looks, merged blocks, sampled people with jobs (section 2), auto-fit plus tap-to-zoom, pinch and pan, tap size targets at zoom (section 2). Test on a real phone in Phase 1. |
| Economy too complex for casual players | One new system per tier (one building, one effect, explained on the tier card), a debt meter you can read on the map (grey), every effect shown on the card. Test "understood without text" in phase 2. |
| Seizure feels punishing | It's always telegraphed (the HUD debt bar turns red near the limit, and the Clockkeeper sheet warns). The building's value comes 60% off your debt and the run continues. Tune with telemetry. |
| Surprise raids feel unfair | Quiet nights are always announced, every raid night gets a hint, the Long Dusk is always day 6, and a wrong guess costs Hours or a level, never the run. Watch telemetry for dusk-loan regret (borrowed on a light night). |
| Hunger feels like a fail state | Idle first, leaving only from day 3, Trade Post food imports, and no game over: an abandoned district comes back when people return. |
| Lore over-explained | Keep `LORE.md` as the canon, one line per in-game beat, and the open questions stay open. |
| Multiplayer scope creep | Data shape only until soft-launch retention justifies a backend; then the staged roadmap in section 12, async only. |
| **Four eras double the art scope** (189 building frames instead of 91) | Modular kits per era (roof, wall and trim pieces), palette ramps, and only the looks each era can reach. Ship Colony and Village first; Town and City follow. |
| Easier growth lets over-borrowers grow | You can't grow while over your limit, and a lore-backed stop (grey homes house half) must make borrowMax fail the people gate. The sim gates plus the pacing gate must stay green before it ships. |
| Rules without a story | Every new rule gets a row in the lore audit (`DESIGN_V2.md`) before it's built. No reason, no rule. |
| Personal features dilute the borrowing focus | Every personal hook touches time or debt (Hesper's trust, the captains, the chronicle of loans and dusks). Copy stays one line per beat. |
| Web performance on cheap Android | **Phase 0 hard gate: fail = Unity before any game code.** Then today's caching rules, budgets and quality tiers from day one, re-running the stress scene every phase. |

## 10. Cursor starter prompt (Phase 1)
```
Port Borrowed Time into a real web stack. References in this folder: prototype.html
(v2 rules between CORE-START/CORE-END, feel, isometric look), sim-test.js (strategy bots
and gates), DESIGN_V2.md (formulas, tables, difficulty curve), LORE.md, VERDICT.md,
FINAL_PLAN.md. Copy the prototype's rules and feel; don't invent new rules.

Stack: TypeScript + Vite + PixiJS v8, GSAP, Vitest, Playwright, Capacitor 8 (Android only).
Shared code (menus/UI kit, versioned save, ads/consent, IAP, test harness, platform) goes in
a self-contained kit/ folder for reuse by One Spark and Loom Rush; if those repos already
have it, reuse theirs and tell me.

Order, in small verified chunks (tests first for each):
0. PERFORMANCE GATE FIRST (FINAL_PLAN.md section 5): a PixiJS v8 + Capacitor stress scene,
   City tier at max density (21x21, looks 5-7 with 2x2/3x3 footprints, 7th-stage ring, outskirts,
   48 crowd clusters), 16 villagers, 24 raiders,
   boats, arrows, fire, 300 particles, grey shader, full-screen day/night tint, looping
   lighting, camera pan/zoom. FINAL-WEIGHT ART, not greybox: stand-in KTX2 atlases at final
   resolution and layer count per the atlas plan, normal maps with 2D lighting, bloom and
   final particle counts. On-screen fps overlay, per-second frame-time CSV, GPU memory readout.
   Build the APK and stop. I test it on a 3-4 GB RAM phone (older Mali-G52/Adreno-610
   class) and on my phone. Pass = 60 fps typical, never below a steady 30 fps at worst
   load, startup under ~3 s, no thermal throttling over 10 minutes, texture memory in budget. If it fails, we switch
   to Unity: write no game code before I confirm it passed.
1. Repo setup with lint, Vitest, Playwright and a CI script.
2. Pure TS rules, no rendering: costMul/cost/limit curves, borrowing (daylight today+,
   tomorrow-), grey lots front-first with half output, interest + Hourglass, default seizure
   (grey first, most invested; nothing-to-seize fallback), credit-only buildings, level-0
   buildings with stageOf(n)=floor(n/3) capped at 6 (7 looks, level cap 20), footprint claims
   (2x2 at look 5, 3x3 at look 7, only into free lots behind), tiers gated by level AND
   population AND not over the credit limit (no Long Dusk/seizure gate), per-tier counts, caps,
   loan and raid scales,
   the 7 tier systems (roads, trade post, academy, hospital, exchange, harbour, observatory),
   the dawn ledger for the Long Dusk, the Charter, pity and the catch-up supply boat (section 3;
   starting targets to verify in the sim), and a lore reason for every rule (DESIGN_V2.md audit), palisade as a ring that re-fits per tier, XP, dusk decisions
   (hold / borrow the dusk / walls), wealth-based raids with ramp(L) and breathers, raid
   damage (grey first, level-0 destroyed only by the boss), season events. Unit tests for
   every rule. Also add a versioned IslandSnapshot, a pure resolveRaid(snapshot, strength,
   seed) and an append-only event log, local only (multiplayer-ready, no backend).
3. Port sim-test.js bots (never, balanced, leverage, borrowMax, reckless). CI gates from
   FINAL_PLAN.md section 6: season-win bands per tier, no dominant strategy, borrowing
   matters at every tier, greedy strategies lose, smooth days-to-next-level, breathers.
4. Pixi isometric greybox at parity: empty island, depth-sorted buildings with 7 looks,
   auto-fit camera per tier with pinch/pan/tap-to-zoom, drawn outskirts, people on screen
   (sampled figures with jobs, caps per quality tier), era palettes as greybox tints,
   palisade ring bought from Build that re-fits on tier-up, grey lots, day/dusk/night light,
   Clockkeeper sheet, dusk decision, raid playback, seizure, tier-up beats, HUD with no
   overlaps, touch and mouse. Follow the perf rules in FINAL_PLAN.md section 5 (cached
   building textures, static grain layer, no blur shadows, camera settles, capped particles,
   storage access that never throws).
5. Playwright e2e with real clicks (desktop DPR 1 and 2, phone touch): empty land -> buy
   palisade -> ring appears, build, upgrade, borrow, each dusk decision, a lost raid hitting
   grey first, seizure, level-up, tier-ups to City, caravans and research, zoom/pan, Continue
   from save, plus screenshots.
6. Capacitor Android build with haptics. Hit the FINAL_PLAN.md budgets (60 fps at City
   on my phone).

Rules: show me the stress-scene APK after chunk 0, a running web build after chunk 4 and an
APK on my phone after chunk 6.
Plain commits using my git config: no signing, no Co-authored-by or Signed-off-by or tool
trailers, never --no-verify. Ask before pushing. Report what's unverified at each step.
```

## 11. Art direction: one era per tier
**Time literally moves on as you grow.** The dial keeps time like a cistern keeps rain. When the colony has kept enough of its own time, the kept years overflow into the island overnight, and it wakes an age later (`LORE.md`, "Why time moves on"). Every building re-skins into the new era at its current look in the transformation cinematic.

Things that never change era:
- **Hesper's striped tent:** she is outside time.
- **The gnomon:** it is older than every era.
- **The Late:** their boats mix eras, each from the age its island went grey.

The City era drifts towards Aster's look on purpose: we may be building what we fled.

| Tier | Era | Palette | Materials | Silhouettes | Music and SFX mood | UI frame |
|---|---|---|---|---|---|---|
| Colony | **Wreck & Frontier** | Sea-salt teal, driftwood grey-brown, sailcloth cream, tar black | Ship timber, canvas, rope, salvaged hull planks | Low lean-tos, upturned-hull roofs, masts as flagpoles, a stake ring | Solo fiddle and tin whistle over surf; rope creak, gulls, hammer taps | Rope-lashed driftwood, sailcloth panels, stencilled crate letters |
| Village | **Hearth & Harvest** (early medieval, farming) | Wheat gold, moss green, ochre, hearth-smoke white | Thatch, wattle and daub, fieldstone, carved oak | Steep thatched roofs, round stone towers, a mill, a long hall | Hurdy-gurdy, drone, frame drum; a bell for dusk | Carved oak, illuminated initials, wax-seal buttons |
| Town | **Gears & Gilt** (Renaissance clockwork) | Terracotta, ultramarine, gold leaf, plaster white | Brick, terracotta tile, marble, brass gears | Domes, arcades, clock-tower campaniles, gear motifs on façades | Lute, harpsichord, a ticking pulse, chime stingers | Parchment in brass astrolabe rings, gilt corners |
| City | **Brass & Steam: the Meridian age** | Brass, verdigris, smoke blue; gaslight amber at night | Iron, glass, riveted brass, sooted brick | Chimneys, glass domes, the observatory, trams on the hour-line avenues, clock-faced towers, steam ferries | A small orchestra with an orchestrion; steam hiss, tram bells | Brass bezel around a glass dial face, enamel labels |

**Look progression inside an era.** Looks 1–2 are the humble arrival of the era. Looks 3–5 are the era settling in. Looks 6–7 are its height: a signature landmark per type (the Colony's best is a beached hull hall; the City's best are the glass domes). Level caps decide which looks each era needs: Colony 1–2, Village 1–4, Town 1–6, City 1–7.

**Rules that hold in every era:**
- Grey land reads the same everywhere: desaturated with a hatch.
- One light direction, from the sun on the gnomon.
- Silhouettes are distinct at phone size (the prototype's contact-sheet test).
- The era palette changes the materials, never the UI's meaning colours (debt terracotta, safe sage, gold for actions).

**Production:**
- Modular kits per era (roof, wall, trim, props), plus palette ramps.
- Build the Colony and Village eras first, and gate each era on a contact sheet reviewed at phone size.

## 12. Multiplayer roadmap (after soft launch, not Phase 1)
**Async only:** no real-time. The world advances on a server tick, a few minutes long (starting target), with one in-game day resolved per tick for the shared world. Each island's own play stays local and instant. Stages, each gated on retention:

1. **Cloud save and account:** anonymous first, linkable later.
2. **More colonies per player** and **sea exploration:** a sea chart, voyages that take in-game days, discoveries such as new islands, dial stones and bottles.
3. **Alliances and trading:**
   - Allies share a chronicle page and can lend Hours to each other, so the lender motif turns social.
   - Trade offers sit on a board, matched at the tick.
4. **Raiding other players:** you send a fleet, and the server resolves it at the next tick against the defender's last snapshot. The defender gets the replay in their chronicle.
   - A shield after being raided.
   - Matchmaking by tier and wealth.
   - "The Late" can become other players' grey islands.

**Data model readiness (shipped in Phase 1):**
- **`IslandSnapshot`** (versioned, compact JSON): lots, buildings, palisade, roads, tier, debt, grey set, tech and defence inputs.
- **Deterministic rules:** `resolveRaid(snapshot, strength, seed)` and the season rules are pure TS with seeded RNG. The server issues the seeds, so the client can't re-roll.
- **Command log:** the client sends intents (build, borrow, repay, decide at dusk) with sequence numbers, never results. The server replays them from the last checkpoint with the same rules and rejects anything that doesn't reproduce.
- **Append-only event log** per island: raids, seizures, tier-ups, trades. It feeds the chronicle and the replays.

**Backend options for a small solo dev:**

| Option | Fit | Notes |
|---|---|---|
| **Supabase** (Postgres, Row Level Security, Edge Functions in TS, scheduled jobs) | Preferred | The TS rules run unchanged in Edge Functions. Relational tables fit trades and alliances. RLS limits every row to its owner. |
| Firebase (Firestore, Cloud Functions, Auth) | Alternative | Mature auth and push. Document data fits snapshots, but trades and alliances need more care. |

**Keep costs down:**
- Snapshots stored as compressed JSON.
- Ticks batched by a scheduled function.
- Poll when the game opens or resumes (push notifications later) instead of keeping sockets open.
- Spend caps and alerts from day one.
- Choose the plan from current pricing at the time; nothing here assumes a price.

**Security (OWASP Top 10 themes):**
- **Broken access control:** all writes go through server functions; RLS on every table; a player can only touch their own islands.
- **Insecure design:** the server is authoritative. It replays commands and **never trusts client-computed results** (Hours, raid outcomes, levels).
- **Injection:** parameterised queries only; validate the schema and size of every payload and snapshot.
- **Authentication failures:** managed auth, rate limits on sign-in and on actions.
- **Integrity failures:** a versioned rules bundle, so old clients are rejected or migrated, and server-side validation of IAP receipts.
- **Misconfiguration and secrets:** no service keys in the client; least-privilege roles.
- **Logging and monitoring:** the event log plus anomaly checks (impossible income, replay mismatches).

**Lore stays open:** the other dials, who lends to the Exchange, what the Late really are, and whether an alliance's shared light changes the dial. None of it gets answered for the sake of a feature.

## 13. Known prototype issues for the build
- **Stale "Empty land" hint:** seen at City after state was injected by test hooks. In the prototype, the hint updates only at day start, on build and on phase changes. In the build, derive the hint from current state whenever it changes.
- **Phone letterbox strips:** the fixed 540×960 logical canvas letterboxes on 390×844 phones, leaving mismatched bars at the top and bottom. In the build, use a responsive layout with safe areas, and fill any margin with the scene's sky and sea.
- **Balanced vs leverage near-tie at Village and City:** the gates pass at 24 runs, but a 36-run sample flips the no-dominant-strategy gate at both tiers. Widen the gap between the two strategies first thing in Phase 1, before tuning anything else.
- **Overcrowded crowd clusters:** replaced by people on screen (section 2).
