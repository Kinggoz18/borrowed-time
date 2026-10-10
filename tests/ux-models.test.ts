import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { EVENT_CAP, trimEvents, upgradeEvents, worthKeeping } from "../src/core/eventlog";
import { CommandError, dispatch, newData, replay, verify, type Command, type LoggedEvent } from "../src/core/game";
import { Rng } from "../src/core/rng";
import { B, B_TYPES, TIERS, type BType } from "../src/core/rules";
import { decodeSave, encodeSave } from "../src/core/save";
import { hashState } from "../src/core/snapshot";
import type { IslandState } from "../src/core/state";
import { BUILD_ORDER, BUILD_GROUPS, cardFor, groupAffordable, teaserFor, visibleGroups } from "../src/ui/buildMenu";
import { charter } from "../src/ui/charterModel";
import { goalModel, keyAction, owedChip, owedState, timeBox } from "../src/ui/hudModel";
import { J_EMPTY, J_ERROR, J_NONE, TITLES, VOICE } from "../src/ui/journalCopy";
import { chaptered, journalEntries, levelMilestone, PAGE } from "../src/ui/journalModel";
import { ledgerRows, profileColony, profileIsland } from "../src/ui/profileModel";
import { numWord } from "../src/ui/words";

const fresh = (seed = 3): IslandState => E.newGame({ seed });

/** A random player (as in determinism.test): refused intents are not logged. */
function play(seed: number, steps: number) {
  const g = newData(seed);
  const all: Command[] = [];
  const r = new Rng(seed + 1000);
  for (let i = 0; i < steps; i++) {
    const st = g.state;
    let cmd: Command;
    if (st.phase === "dusk") cmd = { t: "dusk", decision: (["hold", "borrow", "walls"] as const)[Math.floor(r.next() * 3)] };
    else if (st.phase === "night") cmd = { t: "night" };
    else {
      const p = r.next();
      if (p < 0.55) cmd = { t: "hour" };
      else if (p < 0.72) cmd = { t: "build", type: B_TYPES[Math.floor(r.next() * B_TYPES.length)] };
      else if (p < 0.8) cmd = { t: "research", id: (["ledgers", "rotation", "crossbows", "looms"] as const)[Math.floor(r.next() * 4)] };
      else if (p < 0.9) cmd = { t: "borrow", x: Math.round(r.next() * 30) };
      else cmd = { t: "repay", x: Math.round(r.next() * 60) };
    }
    try {
      dispatch(g, cmd);
      all.push(cmd);
    } catch (e) {
      if (!(e instanceof CommandError)) throw e;
    }
  }
  return { g, all };
}

describe("owed chip", () => {
  it("has four states, each with its own word", () => {
    expect(owedState(0, 67)).toBe("safe");
    expect(owedState(18, 67)).toBe("owed");
    expect(owedState(54, 67)).toBe("near");
    expect(owedState(67, 67)).toBe("near");
    expect(owedState(72, 67)).toBe("over");
    expect(owedChip(0, 67)).toMatchObject({ num: "Safe", word: "Nothing owed", pulse: false });
    expect(owedChip(18, 67)).toMatchObject({ num: "18/67", word: "Owed", pulse: false });
    expect(owedChip(56, 67)).toMatchObject({ num: "56/67", word: "Near limit", pulse: true });
    expect(owedChip(72, 67)).toMatchObject({ num: "72/67", word: "Over the limit", pulse: false });
    expect(owedChip(18, 67).pct).toBeCloseTo(0.27, 1);
  });
});

describe("time plaque", () => {
  it("says hours of light by day, Dusk and Night after, and Long Dusk tonight on day 6", () => {
    const st = fresh();
    st.day = 3;
    expect(timeBox(st)).toMatchObject({ day: "Day 3 of 6", light: `${st.dayLen}h of light`, icon: "sun", lit: st.dayLen, segments: st.dayLen });
    st.hour = 5;
    expect(timeBox(st).light).toBe(`${st.dayLen - 5}h of light`);
    st.day = 6;
    expect(timeBox(st).light).toBe("Long Dusk tonight");
    expect(timeBox(st).pips[5].boss).toBe(true);
    st.phase = "dusk";
    expect(timeBox(st)).toMatchObject({ light: "Dusk", icon: "moon", lit: 0 });
    st.phase = "night";
    expect(timeBox(st).light).toBe("Night");
  });
  it("names a season event only when it is not an ordinary one", () => {
    const st = fresh();
    st.event = "fair";
    expect(timeBox(st).event).toBeNull();
    st.event = "redsails";
    expect(timeBox(st).event).toBe("Red sails");
  });
});

describe("charter and the HUD goal use one source", () => {
  it("builds four rows in a fixed order with hints and the fixing button", () => {
    const st = fresh();
    st.L = 2;
    st.pop = 21;
    const c = charter(st);
    expect(c.title).toBe("Village Charter");
    expect(c.rows.map((r) => r.id)).toEqual(["level", "people", "kept", "seal"]);
    expect(c.rows[0]).toMatchObject({ met: false, value: "Level 2 of 3", hint: "Build and upgrade to earn levels." });
    expect(c.rows[1].value).toBe("21 of 36 settled");
    expect(c.rows[1].action?.label).toBe("Build homes");
    expect(c.rows[1].hint).toMatch(/^Homes for \d+/);
    expect(c.rows[2]).toMatchObject({ met: true, hudValue: "Under limit" });
    expect(c.rows[3]).toMatchObject({ met: true, hudValue: "None" });
    expect(c.met).toBe(2);
    expect(c.hero).toBe("Meet all four and the island wakes in the Village age.");
  });
  it("reports 3 of 4 with the seal sentence, and 4 of 4 as 'grows at dawn' with no grow action", () => {
    const st = fresh();
    st.L = 3;
    st.pop = 40;
    st.hours = 1000;
    for (let i = 0; i < 4; i++) E.build(st, E.greyOrder(st)[i], "cottage");
    st.lien = E.absDay(st) + 5;
    const near = charter(st);
    expect(near.rows[3].value).toBe("Sealed for 5 more days");
    expect(near.rows[3].hudValue).toBe("5 more days");
    if (near.met === 3) expect(near.hero).toContain("Hesper's seal is the last thing");
    st.lien = 0;
    st.tech.rotation = true;
    for (let i = 4; i < 9; i++) E.build(st, E.greyOrder(st)[i], "field");
    for (let i = 9; i < 14; i++) E.build(st, E.greyOrder(st)[i], "cottage");
    for (let i = 0; i < 4; i++) E.build(st, E.greyOrder(st)[i + 14], "cottage");
    const c = charter(st);
    if (c.ready) {
      expect(c.hero).toBe("All four met. The island grows at dawn.");
      expect(c.rows.every((r) => !r.action)).toBe(true);
      expect(goalModel(st)!.line).toBe("Ready at dawn");
    }
    expect(goalModel(st)!.rows).toHaveLength(4);
    expect(goalModel(st)!.rows.map((r) => r.met)).toEqual(c.rows.map((r) => r.met));
  });
  it("says what the next age gives, from the rules", () => {
    const st = fresh();
    const c = charter(st, BUILD_ORDER);
    expect(c.rewards[1].title).toBe(`Room for ${TIERS[1].popCap} people`);
    expect(c.rewards[2].title).toBe(`Buildings grow to Level ${TIERS[1].cap}`);
    expect(c.unlocks).toEqual(["road", "trade", "lantern"]);
    st.tier = 1;
    expect(charter(st, BUILD_ORDER).unlocks).toEqual(["mirror", "hospital"]);
  });
  it("has no goal in the last era", () => {
    const st = fresh();
    st.tier = 3;
    expect(goalModel(st)).toBeNull();
    expect(charter(st).next).toBeNull();
  });
});

describe("build menu", () => {
  const names = (tier: number) => visibleGroups(tier, BUILD_ORDER).flatMap((g) => g.types);
  it("groups every building once, with Roads in Trade and the Hourglass in Civic", () => {
    const all = BUILD_GROUPS.flatMap((g) => g.types);
    expect([...all].sort()).toEqual([...B_TYPES].sort());
    expect(BUILD_GROUPS.find((g) => g.id === "trade")!.types).toContain("road");
    expect(BUILD_GROUPS.find((g) => g.id === "civic")!.types[0]).toBe("bank");
    expect(visibleGroups(0, BUILD_ORDER).map((g) => g.id)).toEqual(["defence", "dwellings", "food", "trade", "civic"]);
    expect(visibleGroups(0, BUILD_ORDER).find((g) => g.id === "civic")!.types).toEqual(["bank"]);
  });
  it("never lists a building above the era (locked items are not rendered)", () => {
    for (const tier of [0, 1, 2, 3]) for (const t of names(tier)) expect(B[t].tier ?? 0).toBeLessThanOrEqual(tier);
    for (const t of ["road", "trade", "lantern", "mirror", "hospital", "exchange", "harbour", "observatory"] as BType[]) expect(names(0)).not.toContain(t);
  });
  it("offers at most one teaser per group, only for the next era, never a name", () => {
    for (const tier of [0, 1, 2, 3]) {
      for (const g of visibleGroups(tier, BUILD_ORDER)) {
        const t = teaserFor(g.id, tier, BUILD_ORDER);
        if (!t) continue;
        for (const name of Object.values(B).map((b) => b.name)) expect(t).not.toContain(name);
        expect(BUILD_GROUPS.find((x) => x.id === g.id)!.types.some((x) => (B[x].tier ?? 0) === tier + 1)).toBe(true);
      }
    }
    expect(teaserFor("dwellings", 0, BUILD_ORDER)).toBe("Bigger homes arrive in the Village.");
    expect(teaserFor("civic", 0, BUILD_ORDER)).toBeNull();
    expect(teaserFor("trade", 1, BUILD_ORDER)).toBe("A new way to make Hours arrives in the Town.");
    expect(teaserFor("defence", 2, BUILD_ORDER)).toBe("A harbour for your boats arrives in the City.");
    expect(teaserFor("trade", 3, BUILD_ORDER)).toBeNull();
    expect(teaserFor("food", 0, BUILD_ORDER)).toBeNull();
  });
  it("reaches every card state with its own copy", () => {
    const st = fresh();
    st.hours = 100;
    expect(cardFor(st, "palisade")).toMatchObject({ state: "can", buy: true });
    st.hours = 3;
    expect(cardFor(st, "palisade")).toMatchObject({ state: "hours", need: E.cost("palisade", 0, 1) - 3, buy: false });
    st.hours = 500;
    expect(cardFor(st, "bank")).toMatchObject({ state: "can" });
    E.build(st, E.greyOrder(st)[0], "bank");
    expect(cardFor(st, "bank")).toMatchObject({ state: "done", built: true });
    E.build(st, undefined, "palisade");
    expect(cardFor(st, "palisade")).toMatchObject({ state: "can", upgrade: true, verb: "Upgrade", meta: "Level 0" });
    for (let i = 0; i < 2; i++) E.build(st, E.greyOrder(st)[i + 1], "field");
    expect(cardFor(st, "field").meta).toBe("2 of 3 built");
    E.build(st, E.greyOrder(st)[5], "field");
    expect(cardFor(st, "field")).toMatchObject({ state: "done", built: true, meta: "All 3 built for now" });
    const t = fresh();
    t.tier = 1;
    t.hours = 500;
    t.debt = E.limit(t) - 1;
    expect(cardFor(t, "lantern")).toMatchObject({ state: "credit", credit: true });
    const full = fresh();
    full.hours = 500;
    for (const k of Object.keys(full.lots)) full.lots[k] = { type: "bank", n: 0, inv: 0 };
    expect(cardFor(full, "tower").state).toBe("nolot");
  });
  it("lights a category when something in it can be bought", () => {
    const st = fresh();
    st.hours = 0;
    expect(visibleGroups(0, BUILD_ORDER).some((g) => groupAffordable(st, g))).toBe(false);
    st.hours = 100;
    expect(groupAffordable(st, visibleGroups(0, BUILD_ORDER)[0])).toBe(true);
  });
});

describe("profile", () => {
  it("says people and homes in words, never as ratios", () => {
    const st = fresh();
    st.pop = 21;
    const p = profileIsland(st, BUILD_ORDER);
    expect(p.rough).toMatch(/^\w+ (is|are) sleeping rough\. A Cottage gives them a roof\.$/);
    st.pop = 6 + 5;
    expect(profileIsland(st, BUILD_ORDER).rough).toBe("Five are sleeping rough. A Cottage gives them a roof.");
    st.pop = 7;
    expect(profileIsland(st, BUILD_ORDER).rough).toBe("One is sleeping rough. A Cottage gives them a roof.");
    expect(numWord(5)).toBe("five");
    expect(numWord(13)).toBe("13");
  });
  it("counts days kept and only lists unlocked buildings and earned marks", () => {
    const st = fresh();
    st.season = 2;
    st.day = 3;
    const c = profileColony(st);
    expect(c.stats.find((s) => s.label === "Days kept")!.n).toBe(9);
    expect(c.toNext).toBe(`0 of ${c.xpMax} to Level 2`);
    expect(c.marks).toEqual([]);
    st.stats.raidsWon = 2;
    st.hours = 100;
    E.build(st, E.greyOrder(st)[0], "field");
    expect(profileColony(st).marks.map((m) => m.id)).toEqual(["night", "roof"]);
    const rows = profileIsland(st, BUILD_ORDER).buildings.map((b) => b.name);
    expect(rows).toContain("Fields");
    expect(rows).not.toContain("Roads");
    expect(rows).not.toContain("Sun Mirror");
    st.tier = 1;
    expect(profileIsland(st, BUILD_ORDER).buildings.map((b) => b.name)).toContain("Roads");
  });
  it("keeps zero rows in the ledger and hides 'taken' until something is taken", () => {
    const st = fresh();
    expect(ledgerRows(st).map((r) => r.label)).toEqual(["Borrowed", "Repaid", "Interest paid", "Nights held", "Nights lost", "Long Dusks held"]);
    st.stats.seized = 1;
    expect(ledgerRows(st).at(-1)!.label).toBe("Buildings taken");
  });
});

describe("event log", () => {
  it("stores the story and never an hour tick, upgrade, quiet dusk or caravan", () => {
    const { g } = play(11, 3000);
    const kinds = new Set(g.events.map((e) => e.kind));
    for (const k of ["hourTick", "dusk", "night", "upgraded", "caravan"]) expect(kinds.has(k as never)).toBe(false);
    expect(g.events.some((e) => e.kind === "raid" && "quiet" in e.result && e.result.quiet)).toBe(false);
    expect(g.events.length).toBeGreaterThan(5);
    expect(g.events.every((e) => e.era !== undefined)).toBe(true);
    expect(worthKeeping({ kind: "hourTick", gain: 1 })).toBe(false);
    expect(worthKeeping({ kind: "repaid", x: 3, cleared: false })).toBe(false);
    expect(worthKeeping({ kind: "repaid", x: 3, cleared: true })).toBe(true);
  });
  it("marks firsts: the first borrowing and the first of each building", () => {
    const g = newData(5);
    g.state.hours = 200;
    dispatch(g, { t: "borrow", x: 5 });
    dispatch(g, { t: "borrow", x: 5 });
    dispatch(g, { t: "build", type: "field" });
    dispatch(g, { t: "build", type: "field" });
    const b = g.events.filter((e) => e.kind === "borrowed");
    expect(b.map((e) => e.first)).toEqual([true, undefined]);
    expect(b[1]).toMatchObject({ lim: E.limit(g.state) });
    expect(g.events.filter((e) => e.kind === "built").map((e) => e.first)).toEqual([true, undefined]);
  });
  it("is capped, and drops the least important entries first", () => {
    const mk = (seq: number, e: object): LoggedEvent => ({ seq, season: 1, day: 1, era: 0, ...e }) as LoggedEvent;
    const log: LoggedEvent[] = [mk(1, { kind: "tierUp", tier: 1 })];
    for (let i = 0; i < EVENT_CAP + 50; i++) log.push(mk(i + 2, i % 2 ? { kind: "built", key: "1,1", type: "field", credit: false, cost: 1 } : { kind: "levelUp", from: 1, to: 2 }));
    log.push(mk(9999, { kind: "seasonEnd", season: 1, won: true }));
    const t = trimEvents(log);
    expect(t.length).toBe(EVENT_CAP);
    expect(t[0].kind).toBe("tierUp");
    expect(t.at(-1)!.kind).toBe("seasonEnd");
    expect(t.filter((e) => e.kind === "built").length).toBeLessThan(log.filter((e) => e.kind === "built").length);
  });
  it("stays within the cap over a long game and replay still matches", () => {
    const g = newData(21);
    const all: Command[] = [];
    const r = new Rng(77);
    for (let i = 0; i < 9000; i++) {
      const st = g.state;
      const cmd: Command = st.phase === "dusk" ? { t: "dusk", decision: "hold" } : st.phase === "night" ? { t: "night" } : r.next() < 0.7 ? { t: "hour" } : r.next() < 0.5 ? { t: "borrow", x: 5 } : { t: "repay", x: 99 };
      try {
        dispatch(g, cmd);
        all.push(cmd);
      } catch (e) {
        if (!(e instanceof CommandError)) throw e;
      }
    }
    expect(g.events.length).toBeLessThanOrEqual(EVENT_CAP);
    expect(verify(g)).toBe(true);
    expect(hashState(replay(g.checkpoint, g.commands))).toBe(hashState(g.state));
  });
  it("loads an old save: drops hour ticks, adds the notes, keeps the island untouched", () => {
    const g = newData(8);
    g.state.hours = 100;
    dispatch(g, { t: "build", type: "field" });
    const old = { ...g, events: [{ kind: "hourTick", gain: 1, seq: 1, season: 1, day: 1 }, ...g.events.map((e) => ({ ...e, era: undefined, first: undefined })), { kind: "hourTick", gain: 2, seq: 3, season: 1, day: 1 }] };
    const raw = encodeSave(old as never, { introDone: true, storyDone: true, colonyName: "X", savedAt: 0 });
    const f = decodeSave(raw)!;
    expect(f.data.events.some((e) => e.kind === "hourTick")).toBe(false);
    expect(f.data.events.find((e) => e.kind === "built")).toMatchObject({ first: true, era: 0 });
    expect(hashState(f.data.state)).toBe(hashState(g.state));
    expect(upgradeEvents([]).length).toBe(0);
  });
});

describe("journal", () => {
  const { g } = play(11, 6000);
  const entries = journalEntries(g.events, g.state.seed);
  it("writes entries newest first, from real events only", () => {
    expect(entries.length).toBeGreaterThan(3);
    const seqs = entries.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => b - a));
    const again = journalEntries(g.events, g.state.seed);
    expect(again.map((e) => e.text)).toEqual(entries.map((e) => e.text));
  });
  it("has no entry for quiet dusks, hour ticks or repeated builds", () => {
    const builds = entries.filter((e) => e.kind === "built" || e.kind === "builtCottage");
    const types = g.events.filter((e) => e.kind === "built" && e.first).length;
    expect(builds.length).toBe(types);
  });
  it("follows the writing rules: under 240 characters, no 'you', no exclamation marks, no engine words", () => {
    const bad = /\b(you|your|tier|popRoom|dayLen|seed|lien|interest rate|defence score)\b/i;
    for (const [k, list] of Object.entries(VOICE)) {
      expect(list.length, k).toBeGreaterThanOrEqual(3);
      for (const t of list) {
        expect(t.length, t).toBeLessThanOrEqual(240);
        for (const s of t.split(/(?<=[.])\s/)) expect(s.length, s).toBeLessThan(160);
        expect(t).not.toMatch(bad);
        expect(t).not.toContain("!");
      }
    }
    for (const [k, list] of Object.entries(TITLES)) {
      expect(list.length, k).toBeGreaterThanOrEqual(3);
      for (const t of list) expect(t.split(" ").length, t).toBeLessThanOrEqual(5 + 2);
    }
    for (const e of entries) {
      expect(e.text.length).toBeLessThanOrEqual(240);
      expect(e.text).not.toContain("{");
      expect(e.title).not.toContain("{");
      if (e.facts) expect(e.facts.length).toBeLessThanOrEqual(60 + 20);
    }
  });
  it("never shows the same variant twice running for one kind", () => {
    const mk = (seq: number): LoggedEvent => ({ kind: "seasonEnd", season: seq, won: true, seq, season2: 0, day: 1, era: 0 }) as never;
    const evs = Array.from({ length: 12 }, (_, i) => mk(i + 1));
    const e = journalEntries(evs, 3);
    for (let i = 1; i < e.length; i++) expect(e[i].text).not.toBe(e[i - 1].text);
  });
  it("writes the six sample kinds from real data", () => {
    const raid = (won: boolean, boss: boolean, extra: object = {}): LoggedEvent => ({ kind: "raid", seq: 1, season: 9, day: 6, era: 3, result: { day: 6, season: 9, boss, kind: "skiffs", S: 100, D: won ? 150 : 50, decision: "hold", won, loot: 31, stolen: 0, damaged: [], villagersLost: 0, ...extra } }) as never;
    const bossWon = journalEntries([raid(true, true)], 1)[0];
    expect(bossWon).toMatchObject({ big: true, tag: { word: "Held" }, group: "nights" });
    expect(bossWon.facts).toContain("31 Hours salvaged");
    const lost = journalEntries([raid(false, false, { villagersLost: 3, saved: 2, stolen: 7 })], 1)[0];
    expect(lost).toMatchObject({ warn: true, tag: { word: "Lost" } });
    expect(lost.text).toContain("three");
    expect(lost.facts).toContain("2 carried home alive");
    const seized = journalEntries([{ kind: "seized", seq: 2, season: 3, day: 4, era: 1, seizure: { k: "1,1", type: "workshop", n: 2, credit: 21 } } as never], 1)[0];
    expect(seized).toMatchObject({ warn: true, group: "hesper", quote: "“Gently, as always.”", facts: "21 Hours written off what we owe" });
    expect(seized.title + seized.text).toContain("Clockworks");
    const near = journalEntries([raid(true, false, { S: 100, D: 104 })], 1)[0];
    expect(near.kind).toBe("nearMiss");
  });
  it("records an age with its landmarks, and milestone levels only", () => {
    const evs = [
      { kind: "tierUp", tier: 2, seq: 1, season: 6, day: 2, era: 2 },
      { kind: "levelUp", from: 4, to: 5, seq: 2, season: 6, day: 3, era: 2 },
      { kind: "levelUp", from: 5, to: 6, seq: 3, season: 6, day: 4, era: 2 },
      { kind: "levelUp", from: 6, to: 7, seq: 4, season: 6, day: 5, era: 2 },
    ] as unknown as LoggedEvent[];
    const e = journalEntries(evs, 1);
    expect(e.some((x) => x.kind === "landmark" && /Town Clock/.test(x.facts!))).toBe(true);
    expect(e.filter((x) => x.kind === "level").length).toBe(1);
    expect(levelMilestone(3, 2, 0)).toBe("cap");
    expect(levelMilestone(6, 5, 1)).toBeNull();
    expect(levelMilestone(10, 9, 1)).toBe("five");
  });
  it("puts chapter headings on the newest entry of each reached age, and hides them under a filter", () => {
    const all = chaptered(entries, "all");
    const heads = all.filter((x) => x.chapter);
    const eras = new Set(entries.map((e) => e.era));
    expect(heads.length).toBe(eras.size);
    expect(chaptered(entries, "nights").every((x) => !x.chapter)).toBe(true);
    expect(chaptered(entries, "nights").every((x) => x.entry.group === "nights")).toBe(true);
    expect(PAGE).toBe(60);
  });
  it("has exact empty, no-result and error copy", () => {
    expect(J_EMPTY.title).toBe("The first page is blank.");
    expect(J_NONE.title).toBe("Nothing here yet.");
    expect(J_ERROR.title).toBe("The book won't open.");
  });
});

describe("laptop key caps", () => {
  it("maps B, H, J, Space, P and Escape; ignores the rest and any modifier", () => {
    expect(keyAction({ key: "b" })).toBe("build");
    expect(keyAction({ key: "B" })).toBe("build");
    expect(keyAction({ key: "h" })).toBe("keeper");
    expect(keyAction({ key: "j" })).toBe("journal");
    expect(keyAction({ key: " ", code: "Space" })).toBe("rest");
    expect(keyAction({ key: "p" })).toBe("pause");
    expect(keyAction({ key: "m" })).toBe("move");
    expect(keyAction({ key: "Escape" })).toBe("close");
    expect(keyAction({ key: "x" })).toBeNull();
    expect(keyAction({ key: "b", ctrlKey: true })).toBeNull();
    expect(keyAction({ key: "j", metaKey: true })).toBeNull();
  });
});

describe("journal facts read right at 1", () => {
  it("says 1 Hour, not 1 Hours", () => {
    const ev = { kind: "borrowed", seq: 1, season: 1, day: 1, x: 1, first: true, shortTomorrow: 0 } as unknown as LoggedEvent;
    const out = journalEntries([ev], 1);
    expect(out[0]?.facts ?? "").not.toMatch(/\b1 Hours\b/);
  });
});
