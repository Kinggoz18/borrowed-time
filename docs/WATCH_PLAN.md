# The Watch: implementation plan (items 1 to 5)

Status: plan only, no code. Written from `/workspace/bt-engagement/PROPOSAL.md` (Quest's engagement proposal; section numbers below point into it), at `main` 3f32f6a. Nothing here has been played on a device. Every effort figure and threshold is a starting target, not a measurement.

Related documents (read these, they are not copied here):
- `docs/LORE.md` (every item cites its lore reason), `docs/DESIGN_V2.md` (formulas, people/jobs/food, lore audit), `docs/FINAL_PLAN_BT.md` (sections 2, 3, 8), `docs/SIM_GATES.md` (the gates), `docs/DECISIONS.md`.
- UX spec: `/workspace/bt-ux-spec/UX_SPEC.md` (Facet; HUD section 4, Profile 5, Charter 6, Build 7, Journal 8, new data 9, implementation order 11, acceptance checklist 12). This plan refers to it by section and does not repeat its layouts, copy or tokens. Where the two disagree, the UX spec wins on look and copy, this plan wins on state, saves and tests.

## 0. Owner decisions that shape this plan

1. **Villagers have needs but no names.** Nell, Tobias, Ada and Hesper stay the only named characters (Margery the goat and the Late captains in item 9 are separate, and not in this plan). So Quest's item 7 "named notables" is dropped. Nothing in The Watch generates a person's name: no roster, no "Wren", no named losses. People stay a count (`state.pop`) with a state, and copy speaks in groups ("Five are sleeping rough").
2. **Items 1 to 4 are "The Watch", the first slice. Item 5 (season letters) follows it** as its own slice, after the owner has judged the first four.
3. **Both slices are queued for building.** Order: finish the current batch of fixes (12-hour day, UX build, build menu, music), then The Watch, then season letters.
4. **Villager needs must drive real mechanics, not decoration** (section 1.4).
5. **The Portal** (Modern/Futuristic/Fantasy packs and hour packs) is a lore tease only. It is in `docs/BACKLOG.md`, and nothing in this plan implements or hints at it in code.

## 1. Shared groundwork

### 1.1 The day clock (new 12-hour day at 0.7x speed)
- The day is 12 in-game hours (`BASE_DAY = 12` in `src/core/rules.ts`, the income divisor in `tickHour`) and the clock runs at 0.7x (`HOUR_MS` in `src/game/session.ts`: 2500 ms becomes about 3571 ms, so a day is about 43 s at 1x). Both are set by the current fix batch. **Confirm both at the start of work** and read them from those constants; never write 12 or 3571 into new code.
- If the owner later picks 10 hours instead, that is a rules change (`BASE_DAY` divides income), so it needs the gates re-run. The Watch must not hard-code either number.
- Anything that fires "at a time of day" is a fraction of `dayLen`, not an hour number, because `dayLen` shrinks after a borrowed dusk (`MIN_DAY = 7`, `shortTomorrow`). Noon call hour = `round(NOON_FRAC * dayLen)` with `NOON_FRAC = 0.6` (hour 7 of 12), clamped to at least 1 and below `dayLen`.
- A slower clock makes dead time longer (proposal W10). The Watch adds a beat in every day (the noon call), a calm night without a modal, and a goal strip, so the slower clock is not just slower.

### 1.2 One save migration, with room (v1 to v2)
Quest's risk (i): do the migration once. `SAVE_VERSION` 1 becomes 2 in `src/core/save.ts`. `SaveMeta` (UI-side, outside the replayable island state) gains a `v2` block with defaults, so item 5 and later items do not need another bump:

```
meta.firsts: string[]            // item 2: ids of "first time" lines already shown
meta.goalsDone: string[]         // item 3: completed goal ids
meta.calledDay: number           // item 1: last (season*10+day) a noon call fired, so resume cannot repeat it
meta.colonyName: string          // exists; item 4 lets the player set it
meta.crest: {shape,charge,c1,c2} | null   // item 4
meta.chapters: { shared: string[] }       // item 4: share cards already offered
meta.log: { sessions, minutes, firstSeenAt, lastSeenAt, tier, goalsDone, lastScreen, quitAt }  // local only, no network
meta.letters: { seen: string[] } // reserved for item 5, empty now
```

Rules for the migration (tested in `tests/save.test.ts`): a v1 file loads with all defaults ("New Patience" stays the name, `firsts` empty, goals recomputed from state); unknown keys are ignored; a newer version or corrupt file still returns null and starts fresh (existing behaviour); `data` (commands, checkpoint, state) is untouched, so `verify()` stays true on migrated saves. First-time lines for a migrated save: seed `firsts` from the island itself (a save that has already borrowed, been raided or held a night starts with those ids set, so existing players do not see them again).

### 1.3 Presentation-only rule
Items 1 to 4 read the island state and write only `SaveMeta`. They draw nothing from the island RNG and add no `Command`. A test in each item proves `hashState` and `verify()` are the same with the feature on and off. Item 5 is the first to add a `Command` (section 6).

### 1.4 Villager needs: real mechanics, not decoration
The rules already have two real needs: **food** (each person eats 1 a day; the unfed go idle, then from day 3 families leave at dawn) and **shelter** (homes cap the population). Posts and defence give a third (**safety**: people stand on the walls, and people on grey land are the ones caught in a raid). **Rest** is the fourth and has no mechanic today.

Standing rule for this plan and everything after it: a need appears in the UI only if it is computed from state and changes an outcome the player can change. Concretely:
- In The Watch, needs are **derived, never stored**: `needs(state)` is a pure function returning four group states (`ok / strained / failing`) plus the count affected, from `pop`, food, homes, posts and grey land. It reads existing numbers, so it cannot change the rules. It feeds three things: the Profile Colony pane copy (UX spec section 5.3, "Five are sleeping rough"), goals (section 4: "Have Food 20 and Homes 20", "Spend a day with no grey land"), and the morning card ("N people left: not enough food or homes" becomes "Three families rowed away. There was not enough to eat.").
- **Rest has no mechanic, so The Watch shows no rest meter.** Showing a rest bar now would be decoration. Rest becomes a real need in a later slice with its own rule (candidate: a long day with no Hourglass/home capacity lowers output the next morning), a lore reason, and a gate re-run. Until then, the 12-hour day is the only rest-flavoured copy, and it says nothing a rule does not back.
- Any future need effect (output, leaving, defence) goes in `rules.ts` and `DESIGN_V2.md` "People, jobs and food", is table-driven, and is covered by the gates. A need that changes no number is deleted, not kept as flavour.
- No names anywhere in needs copy: groups only ("Two families", "the night watch", "the youngest streets").

### 1.5 Events and the log
`session.data.events` stores every `hourTick`. The journal (item 2) and chronicle (item 4) read it, and Quest estimated about 1 KB per season (PHASE1_REVIEW #16, not re-measured). Measure first (45 balanced-bot seasons through `dispatch`), then set a cap. Compaction keeps every event kind the journal shows (UX spec 8.4) and drops `hourTick`, `dusk`, `night`, `quiet` and repeated builds after their day is closed. Replay uses commands, not events, so `verify()` is unaffected; a test proves it.

## 2. Item 1: Noon call and the visible dusk threat

**User-facing behaviour.** At the noon fraction of each day the watch calls out. On a raid or Long Dusk day it shows the existing dusk hint (kind + light/even/heavy band, one cryptic line) as a short banner and a coloured pennant on the HUD day box. Sails (3 to 6 sprites, tinted by raid kind: grey for skiffs, a deep hull for longboats; ghosts show nothing unless a Watchtower at level 3 or an Observatory spots them) appear far out and drift closer until dusk. On quiet days the call is "Calm sea." at the same time. The clock drops from Rest 8x to 1x at the call (as `dusk()` already does). The dusk card is unchanged. Placement of the pennant and banner follows the UX spec HUD (section 4: time plaque, one goal, actions); the call must not cover the goal strip or action bar at 800x360, 667x375, 360x800 or a 1440x900 laptop.

**Lore reason.** LORE "The raiders": "The watchtower can vouch for an empty horizon... the gulls go quiet, oars carry over the water, sometimes drums." The call is that line, said earlier in the day.

**Data/state.** No island state. `meta.calledDay` (section 1.2) prevents a repeat on resume. A pure `noonCall(state)` in `src/core/hints.ts` returns `{kind, band, line, sails}` (or the calm line), calling the same functions as `duskHint`/`duskRead`. Sail count and tint come from `kind`; sail drift is a function of `hour / dayLen`, so it needs no stored position.

**Files to touch.**
- `src/core/hints.ts` (`noonCall`, `noonHour(dayLen)`), `src/core/raiders.ts` (read-only: tactic to sail tint).
- `src/game/session.ts` (fire the call from the hour tick in UI space, set `calledDay`, drop Rest speed to 1x), `src/ui/app.ts` (banner, pennant, remove the dusk-only hint path from being the first time the hint is seen), `src/ui/copy.ts` (call lines, calm line).
- `src/render/island/` (sails layer: sprites, drift, removal at dawn; respects the graphics quality setting like other ambient art, with fewer sails on Low and none when reduced motion is on).
- `src/art/` (sail sprites in the v3 pixel style; two tints plus the hull).
- `tests/hints.test.ts`, `tests/raid-presentation.test.ts`, `tests/session.test.ts`, `e2e/game.spec.ts`.

**Tests.**
- Unit (extend `tests/hints.test.ts`): the call fires once per day at `noonHour(dayLen)` on raid, boss and quiet days; for `dayLen` 7 to 12 the hour is valid and before dusk; reading the call draws no RNG (state hash before = after); a resumed day past the call hour does not fire again (`calledDay`); the 12-hour and shortened days both work; the hint at noon equals the hint at dusk for the same state (same function), so the player is never told two different things.
- Replay: a 10-season scripted game with calls on has the same `hashState` and `verify() === true` as with calls off.
- UI unit/e2e: banner appears once; Rest speed returns to 1x; sails appear at the call and are gone at dawn; quiet day shows "Calm sea."; all new controls at least 44 px (existing tap-target test).
- Existing `parity`, `determinism` and gate suites unchanged and green.

**Acceptance criteria.**
1. Raid/boss day: hint line and pennant appear exactly once at the noon hour; quiet day: "Calm sea." at the same hour; reload after that hour does not repeat it.
2. Speed is 1x after the call; sails drift in and are removed at dawn; none cover buildings at the default zoom.
3. A player who reacts to the call can spend Hours, repay, upgrade or add a Watchtower before dusk (building is still refused at dusk by design).
4. `hashState` identical with and without the call; no new island RNG draws.

**Risks.** Sails hiding buildings or the grey-land signal (check at default zoom and High quality; cap sail count and keep them in the sea border). The call feeling like a popup (banner, not a modal; never pauses the clock). The hint becoming too good: it is the same band the dusk card shows, so no new information is created, only earlier; do not make it more precise.

**What must not change.** Raid strength, hit orders, tactics, the dusk card numbers (DECISIONS #20), the `DAY_KIND` calendar (days 2 and 4 raid, day 6 Long Dusk), `BASE_DAY`, income, interest. Quiet days stay quiet.

**Order and commits.**
1. `feat(core): noon call as a pure function over the dusk hint` (+ unit tests).
2. `feat(game): fire the noon call once per day, drop Rest to 1x, persist calledDay` (+ session tests; needs the save v2 chunk from item 2 first if `calledDay` is persisted; otherwise keep it in memory and persist in chunk 4 of item 2).
3. `feat(ui): noon banner and day-box pennant`.
4. `feat(render): sails on the horizon, per kind, per quality`.
5. `test(e2e): noon call, resume, Rest drop`.

## 3. Item 2: Reward-moment fixes

**User-facing behaviour.**
- (a) First-time lines (first borrow, first grey land, first raid, first held night) show once per colony, not once per launch.
- (b) Quiet evenings: no card. A toast "Calm sea." and the night starts within 2.5 s (tap to skip). The morning report still shows when it has items.
- (c) A real journal: borrow, pay-to-zero, level, season result, tier, nick-of-time, tier-ups and seizures, dated "Season 4, Day 6", builds collapsed per day. The look, filters, chapter headings, empty/error states, cover and the six sample entries are in UX spec section 8; build that, do not redesign it. The page size is 60 entries with "Earlier pages" (UX spec 8.4; Quest's "24 to 60").
- (d) Two flourishes: a squash and sparkle on a lot when it gets a new look, and a one-time "In the nick of time!" flourish on a narrow win (the card already says it under an 8% margin). Both respect the quality setting and reduced motion.
- Journal copy is the second thing the owner asked for explicitly ("much better writing"): entries are templated from real data (UX spec 8.9, 8.10), in the lore voice, with no named villagers.

**Lore reason.** Ada's chronicle (LORE "The chronicle"); Hesper's lines and the pun table (one pun per screen, "nick of time" used once).

**Data/state.** `meta.firsts` (section 1.2), seeded for old saves. The journal is a pure `journalEntries(events, meta)` (UX spec 8.4): no text stored. Event-log compaction (section 1.5) goes in this item. Journal needs events that do not exist today: confirm that `borrowed`, `repaid`-to-zero, `levelUp`, `seasonEnd` and `tierUp` are emitted by the engine as `GameEvent`s; where one is missing, **add it as an event only (no state or rule change)**, with the parity test proving the replay is unchanged.

**Files to touch.**
- `src/core/save.ts` (version 2, defaults, migration), `src/game/session.ts` (meta handling), `src/core/game.ts` and `src/core/engine.ts` (emit missing events only), `src/ui/app.ts` (replace the in-memory `seen` set; quiet night path; journal sheet), `src/ui/copy.ts` (journal variants, first-time lines), `src/ui/ui.css`, `src/render/island/` (flourish).
- `tests/save.test.ts`, `tests/core-engine.test.ts` (events only), a new `tests/journal.test.ts`, `tests/session.test.ts`, `e2e/game.spec.ts`.

**Tests.**
- Save: v1 to v2 keeps all data, applies defaults, seeds `firsts` from the island, ignores unknown keys; newer or corrupt saves start fresh.
- Firsts: an id is never emitted twice across save and load (unit); kill and relaunch does not replay (e2e).
- Journal formatter: table-driven kind to entry, collapse of builds per day, 60 per page, no entry for `hourTick`, `dusk`, `night`, `quiet`; every token in UX spec 8.10 resolves from real data; no entry text contains a name other than Nell, Tobias, Ada, Hesper or the colony name (a regex test over all variants).
- Event compaction: `verify()` stays true; the save after 45 balanced-bot seasons is under the cap set after measuring (Quest proposes 200 KB; measure first).
- E2E: a quiet night advances with no click and the morning card still appears; tap skips; journal opens from the action bar button and key J (UX spec 4); empty and error states.
- Engine event additions: `parity` and `determinism` suites identical.

**Acceptance criteria.**
1. After a save, relaunching does not replay first-borrow/grey/raid/held lines.
2. No quiet-night modal; toast then night within 2.5 s; morning report still appears when it has content.
3. Journal shows borrow, repay-to-zero, level, season result, tier, nick-of-time, dated; builds collapse per day; scrolls; 60 per page.
4. v1 saves load with defaults; corrupt/newer saves start fresh.
5. UX spec section 12 Journal checks pass (44 px targets, 12 px text, AA contrast).

**Risks.** Adding engine events could change replay output if done carelessly (events only, parity test). Compaction removing something the journal needs (the kinds list is the test). Players who skip a quiet night lose nothing but a click, but the pacing of 2.5 s may feel rushed or slow: make it a constant, check on device. The journal depends on the UX build of the Journal (spec section 11 step 7): either build after it, or build `journalEntries()` and the tests first and the sheet second.

**What must not change.** Every rule, the event kinds that the replay or gates read, interest, raids. No new `Command`.

**Order and commits.**
1. `feat(save): v2 meta block with firsts, goals, crest, log and letters defaults, migration from v1`.
2. `feat(game): persist first-time lines and seed them for existing saves`.
3. `feat(core): emit missing journal events (borrow, repay-to-zero, level, season end)` (events only).
4. `feat(core): journal entries as a pure function, with collapse and paging`.
5. `feat(core): compact the event log per closed day, keep journal kinds`.
6. `feat(ui): quiet nights without a modal`.
7. `feat(ui): journal sheet per the UX spec, with the writing tables`.
8. `feat(render): new-look and nick-of-time flourishes`.

## 4. Item 3: Goal ladder, "Ada's list"

**User-facing behaviour.** Three live goals at a time, shown as one pinned goal in the HUD (UX spec section 4: the HUD shows one charter goal) and the full three in a sheet that opens from it. About 24 goals for Colony and Village, each one to three in-game days of play, for example "Build a Watchtower before the dusk", "Pay Hesper to zero once", "Hold a night with Walls", "Raise a Field to its second look", "Have Food 20 and Homes 20", "Send a caravan", "Spend a day with no grey land". The tier charter stays (UX spec section 6); its first blocker becomes goal 1 ("one suggested next action", FINAL_PLAN section 3). Completing a goal shows a line from Ada and adds a chronicle entry. Goals can be ignored without penalty or nagging.

**Lore reason.** "Ada's list on the wall", the colony's charter (FINAL_PLAN section 3). She is the only named voice for goals.

**Data/state.** A data table `GOALS` (id, predicate over `IslandState` plus `meta`, line, order, tier range). `meta.goalsDone` stores completed ids. `activeGoals(state, firsts, done)` is a pure function that returns the first three not-done goals whose prerequisites are met. Counters that goals need and `stats` does not hold (for example "nights held with walls") are derived from the compacted event log or kept as small `meta.log` counters. No `IslandState` change.

Villager needs feed goals: need-based goals use `needs(state)` from section 1.4 (food, shelter, safety) and teach the real mechanic ("Nobody eats a wall. Raise a Field.").

**Reward (decision for the owner).** Quest proposes XP rewards, capped at 10% of the next level's need. XP changes level timing and so gates G5, G7 and G8. To keep The Watch gate-neutral:
- **Default in this slice: rewards are the line, the chronicle entry and a tick, no XP.** `GOAL_XP_PCT = 0`.
- Final optional commit: set `GOAL_XP_PCT` (at most 0.1) behind a `claimGoal` `Command` (so XP is part of the replay and `verify()`), re-run all gates with a goal-following bot added to `src/core/bots.ts`, and keep it only if G5, G7 and G8 hold. No Hours rewards (later, at most 0.3 x daily income, re-gated).

**Files to touch.** `src/core/goals.ts` (new: table and pure functions), `src/core/needs.ts` (new, section 1.4), `src/ui/app.ts` (HUD goal, goal sheet), `src/ui/copy.ts` (goal and Ada lines), `src/ui/ui.css`, `src/core/bots.ts` (goal-following variant, only for the optional XP commit), `tests/goals.test.ts` (new), `tests/needs.test.ts` (new), `e2e/game.spec.ts`.

**Tests.**
- `activeGoals` from `newGame` returns the expected first three (Palisade, Field, borrow-or-hold per Quest's acceptance criterion 5).
- Over the balanced and leverage bot campaigns, at least 95% of days have three active goals through Village (the rest only on the day one completes); no duplicate ids; every id completes once and stays done after save and load; goals never read RNG; `hashState` unchanged.
- Each predicate has a positive and a negative fixture; the table covers every Colony and Village building at least once.
- `needs(state)` fixtures: fed/unfed, housed/unhoused, grey land vs not; pure.
- Optional XP commit: reward cap property; G5, G7, G8 re-run and recorded in `SIM_GATES.md`.
- E2E: goal strip visible without crowding the HUD at 800x360 and 360x800; completing a goal updates the strip and the journal; no horizontal overflow.

**Acceptance criteria.**
1. From day 1 to Village there are three active goals (95% of bot-campaign days at minimum).
2. Each goal completes once and persists; first set is as above; replays identical.
3. With `GOAL_XP_PCT = 0` the gate results are byte-identical to `main`.
4. The HUD stays within the UX spec HUD layout (one goal only).

**Risks.** Goals feeling like chores (cap at three, no timers, no penalties, never block play). Goals steering players toward a bot-like strategy that makes borrowing irrelevant: a goal set must include borrowing and repaying, and the leverage and never-borrow campaigns must still be fine. Predicates reading counters that compaction removed (test with compaction on). Copy drifting to named people (the same regex test as the journal).

**What must not change.** Raid and economy rules, the tier charter's requirements, level thresholds, XP formulas (unless the optional XP commit is explicitly taken and re-gated).

**Order and commits.**
1. `feat(core): villager needs derived from state, pure and read-only`.
2. `feat(core): goal table and activeGoals as pure functions`.
3. `feat(game): persist completed goals in the save meta`.
4. `feat(ui): pinned goal and Ada's list sheet`.
5. `feat(ui): goal completion lines and chronicle entries`.
6. (optional, needs the owner's yes) `feat(core): goal XP through a claimGoal command, gates re-run`.

## 5. Item 4: Chronicle, colony name and crest, shareable tier card

**User-facing behaviour.** After the arrival story, a short step asks for the colony name (suggestions "New Patience", "Margery's Rest", free text) and a crest (shape, charge, two colours). The Journal becomes Ada's book: chapter headings per age and a cover with the crest and name (the laptop cover and chapter jump are in UX spec 8.3). At each tier-up and each Long Dusk win a shareable image card is offered (colony name, crest, season, one line), shared through the system share sheet. The step must be skippable ("Keep New Patience"), and the crest can ship name-only first.

**Lore reason.** LORE "The chronicle": each age starts a new chapter with our crest on the cover; "Hesper has asked to read it. Twice." The founder names the colony (LORE "The founder (you)").

**Data/state.** `meta.colonyName` (exists), `meta.crest`, `meta.chapters.shared` (section 1.2). `Session.fresh(..., "New Patience")` in `src/game/boot.ts` stays the default. The crest renders from a small pure description to a canvas at three sizes, so no image is stored. The share card is rendered to a PNG on demand and shared with `@capacitor/share` plus `@capacitor/filesystem` (both already dependencies; no new native plugin). Event-log compaction (item 2) bounds save growth.

**Mechanic honesty.** The chronicle is read-only. It is tied in by goals (chronicle entries on completion) and, when Hesper's trust seals exist (a later slice), by "she asks to read it". Until then it is a story surface and the release notes must not call it a system (Quest's risk j).

**Files to touch.** `src/game/boot.ts`, `src/game/session.ts`, `src/core/save.ts` (already migrated), `src/ui/app.ts` (naming step, crest picker, cover, share offer), `src/ui/intro.ts` (hook after the story), `src/ui/copy.ts`, `src/ui/ui.css`, `src/art/` or `src/ui/` (crest and card renderers), `src/platform/` (share adapter with a web fallback to download), `tests/chronicle.test.ts` (new), `tests/save.test.ts`, `e2e/game.spec.ts`.

**Tests.**
- Name and crest round-trip through `SaveMeta`; migration default; empty, over-long and whitespace names are trimmed and capped; a name never breaks layout (long and emoji cases).
- Crest renders deterministically at three sizes (snapshot or hash of pixel data); every shape/charge/colour combination renders without throwing.
- Share card: the same inputs give the same image; web fallback works; the share sheet is only invoked on a player tap, never automatically.
- Event archive keeps `verify()` true; save size cap after 45 seasons (section 1.5).
- E2E: new game shows the naming step after the story; skip keeps the default; the name appears on the Journal cover and in Profile.

**Acceptance criteria.**
1. The player can name the colony and pick a crest, or skip; both persist.
2. The Journal cover shows name and crest; chapter headings per reached age.
3. A tier-up and a Long Dusk win each offer a share card with the right name, season and line, only after a tap.
4. The save stays under the measured cap after 45 seasons.
5. `hashState` unchanged, no new RNG draws.

**Risks.** Naming as a hurdle before play (skippable, one screen, after the story, not before the first decision). Share card quality and Android file handling (device test). User-entered text: it is shown only on-device and on cards the player shares; no profanity filter is needed locally, but nothing is sent to a server (backend and moderation are later work). Crest art cost (ship name-only if it slips).

**What must not change.** Rules, the intro story text, the default colony name, existing saves (they keep "New Patience" until renamed).

**Order and commits.**
1. `feat(game): colony name editable and persisted` (+ tests).
2. `feat(ui): naming step after the arrival story, skippable`.
3. `feat(ui): journal cover and era chapters with the colony name`.
4. `feat(art): crest description and renderer at three sizes`.
5. `feat(ui): crest picker`.
6. `feat(ui): shareable tier and Long Dusk card through the share sheet`.
7. `test(e2e): naming, skip, cover, share offer`.

## 6. Item 5: Season letters (follows The Watch)

**User-facing behaviour.** Once a season, on day 3 at the noon call (the emptiest day today), a bottle washes up or a sail comes in with one letter and two or three choices. Each choice shows its cost and benefit before the player picks. About 10 letters for Colony and Village at first. Examples from the proposal: "Don't borrow on the sixth day" (the bottle in LORE; heed it by repaying by day 5, or ignore it; it teaches that the Long Dusk takes what is owed at dawn on day 6); a sail from another dial offers grain for Hours; Margery standing on a dial stone (follow her for a lore page and a small reward, or stay for a building discount); an Aster clerk measuring the coast (let him in for lower interest this season, with Aster's eyes on you, or turn him away). The existing season event (a random global modifier) stays. Letters never answer an open lore question (LORE open questions 1 to 8): they hint.

**Villager needs in letters.** Letters are where needs get their stakes: a grain deal changes food, a shelter offer changes homes, a watch offer changes defence. No letter names a villager; groups only.

**Lore reason.** LORE "Bottles", "Aster is still counting", "Margery", "Other dials". Letters come from the wider world, never from invented named people (owner decision).

**Data/state.** This is the first item that changes rules, so it is its own slice with its own gates.
- A new `Command` `letter {season, choice}` applied in `engine.ts`; effects are rows in a table in `rules.ts` (deltas to food, interest, Hours, defence, building discount for the season), shown in the UI from the same table so the screen can never disagree with the rule.
- The schedule is a pure function of (island seed, season), so replay and any future multiplayer stay exact. At most one letter per season.
- State: the chosen option and its season-long effect live in `IslandState` (a small `letter` field) so they replay; `meta.letters.seen` only remembers which letters have been read (for the journal and repeat avoidance). This needs the island-state side of the migration: add `letter: null` default in the v2 to v3 or in the same v2 step if it ships together (decide when item 5 starts; do not change the island state before that).
- `useRuleset("prototype")` ignores letters so parity with the prototype holds (as with tactics, DECISIONS #21).

**Files to touch.** `src/core/rules.ts` (letter table, season effects), `src/core/engine.ts` (`letter` command, effect application, expiry at the season's end), `src/core/state.ts` (field), `src/core/game.ts` (command type), `src/core/save.ts` (validate the new field), `src/core/bots.ts` (bots choose: random and greedy), `src/core/gates.ts` and `tests/sim/gates.sim.test.ts` (new gate for letters), `src/ui/app.ts`, `src/ui/copy.ts` (letters), `src/ui/ui.css`, `tests/letters.test.ts` (new), `docs/SIM_GATES.md`, `docs/DECISIONS.md`, `docs/DESIGN_V2.md` (lore audit row per letter: no reason, no rule).

**Tests.**
- Table-driven: each option applies exactly its listed delta; no option leaves a negative balance or an invalid state.
- Schedule is a pure function of (seed, season), identical on replay; at most one letter per season; `verify()` true with letters on.
- Gates: G1 to G9 with letters on, bots choosing at random and by greedy value; they must all still hold. A no-dominant-option test: the expected-value spread between a letter's options stays under a set margin, so there is no always-pick option.
- Parity: `useRuleset("prototype")` identical to the reference.
- Copy test: no named villager appears in any letter; every effect named in the text exists in the table.
- E2E: a letter shows at the day-3 noon call, can be answered in under about 10 seconds, shows the cost first, and appears in the journal.

**Acceptance criteria.**
1. One letter per season on day 3 at noon, deterministic per (seed, season).
2. Every option's effect matches its text exactly, and is replayable.
3. All gates G1 to G9 pass with letters on; margins recorded in `SIM_GATES.md`.
4. Heeding "Don't borrow on the sixth day" teaches a rule that is true in the engine (`nominalRaw`, the Long Dusk at dawn on day 6).

**Risks.** Gate margins are thin (SIM_GATES: G9-Village 5.8 of 6, G1-Colony 92% of 95%, G2-Town near a tie, G7-City 0.8% of 0.5%), so letters must be small and may need re-tuning. A letter that feels like a trap: every cost is visible before choosing. Day 3 may become a raid day if the surprise calendar (Quest item 8, not in this plan) is built later; the schedule must read `dayKind` and not assume day 3 is quiet.

**What must not change.** Core raid strength, the borrow verb, interest outside the letter's own season-long effect, the hint rules.

**Order and commits.**
1. `docs: letter table and lore audit rows` (copy and effects on paper first).
2. `feat(core): letter schedule as a pure function of seed and season`.
3. `feat(core): letter command and season effects, table driven`.
4. `feat(core): bots choose letters, letters gate added`.
5. `feat(ui): letter card at the noon call`.
6. `feat(ui): journal entries and chronicle lines for letters`.
7. `docs: gate results and decisions for letters`.

## 7. Cross-cutting

### 7.1 Order of work for the two slices
1. Prerequisites: the current fix batch (12-hour day at 0.7x, build menu, music) and the UX build that supplies the HUD goal slot, the Journal button and the Journal sheet (UX spec section 11).
2. The Watch: item 2 chunk 1 (save v2) first, then items 1, 2, 3, 4 in the order of the chunks above. Items 1 and 2 are independent after the save chunk and can be built in either order; item 3 needs the goal slot in the HUD and the journal events; item 4 needs the journal cover.
3. Owner review of The Watch on a device (below), then item 5 as its own slice.

### 7.2 What must not change in The Watch (items 1 to 4)
- Combat: raid strength, tactics, hit orders, the Long Dusk, salvage and rebuild costs, `DAY_KIND`.
- Economy: `BASE_DAY` as the income divisor, interest, borrow limits, costs, XP formulas (with `GOAL_XP_PCT = 0`), tier requirements, food and housing rules.
- Sim gates: `npm run test:gates` results identical to `main` (G1 to G9, `SIM_GATES.md`). Run once at the start and once at the end of the slice and paste both into the PR.
- Determinism: no new island RNG draws; `verify()` true; `parity` and `determinism` suites unchanged.
- Perf/stress tests stay off (DECISIONS #16): they run only with `RUN_STRESS=1`.

### 7.3 Quality bar for every commit
`npm run typecheck`, `npm run lint`, `npm test` and `npm run test:gates` pass; `npm run test:e2e` for UI chunks, at 800x360, 667x375, 360x800 and a laptop size (1440x900), because the owner plays on a much wider laptop screen too; UX spec section 12 checks for anything it covers. Small commits so a restart cannot lose work.

### 7.4 Owner device checklist for The Watch (the only way to judge it)
Fresh install, play 30 minutes, then rate 1 to 10: (a) "I always knew what to do next", (b) "Dusk felt like a plan, not a button press", (c) "I wanted one more day", (d) "I would tell someone what happened". Note the minute you first felt bored and what you were doing. Also check: the noon call is readable in sunlight; sails are visible without covering buildings; quiet-night pacing; the goal strip does not crowd the HUD; the share card looks postable; the back button and lock/unlock keep the same hour. Target (a hypothesis, not a promise): about 7 after The Watch, about 8 after season letters and the later items. If The Watch scores flat, stop and look at the local session log before building more.

### 7.5 Open items for the owner
- Goal XP: leave at zero in this slice, or re-gate and turn on (section 4).
- Crest in the first release, or name only (section 5).
- Whether the 12-hour day stays or becomes 10 (rules change, gates re-run; section 1.1).
- Rest as a real need: a later slice, needs its own rule and gate (section 1.4).
