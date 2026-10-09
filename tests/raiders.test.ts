import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { duskHint, HIDDEN, LINES } from "../src/core/hints";
import { canSpot, kindsForTier, raidKind, stealthHidden, TACTICS, type RaidKind } from "../src/core/raiders";
import { useRuleset } from "../src/core/rules";
import { cloneState, hashState } from "../src/core/snapshot";
import type { IslandState } from "../src/core/state";

const fresh = (seed = 3): IslandState => E.newGame({ seed });
const lot = (st: IslandState) => E.greyOrder(st).slice().reverse().find((k) => E.isFree(st, k))!;

function onKind(st: IslandState, kind: RaidKind, day = 2): void {
  st.day = day;
  for (let s = 1; s < 120; s++) {
    st.season = s;
    if (raidKind(st) === kind) return;
  }
  throw new Error(`no ${kind} on day ${day} at tier ${st.tier}`);
}

describe("raider kinds by era", () => {
  it("Colony only fields skiffs and longboats, in the old 2:1 pattern", () => {
    const st = fresh();
    expect(kindsForTier(0)).toEqual(["longboats", "skiffs", "skiffs"]);
    st.season = 1;
    st.day = 2;
    expect(raidKind(st)).toBe("longboats");
    st.day = 4;
    expect(raidKind(st)).toBe("skiffs");
    const seen = new Set<RaidKind>();
    for (let s = 1; s <= 12; s++) {
      st.season = s;
      for (const d of [2, 4]) {
        st.day = d;
        seen.add(raidKind(st));
      }
    }
    expect([...seen].sort()).toEqual(["longboats", "skiffs"]);
  });
  it("each new era unlocks a stealth type and one more tactic", () => {
    expect(kindsForTier(1)).toEqual(expect.arrayContaining(["ghosts", "runners"]));
    expect(kindsForTier(2)).toEqual(expect.arrayContaining(["siege", "rams"]));
    expect(kindsForTier(3)).toEqual(expect.arrayContaining(["ironclads", "meters"]));
    expect(kindsForTier(0)).not.toContain("ghosts");
    expect(kindsForTier(0)).not.toContain("siege");
    expect(kindsForTier(0)).not.toContain("ironclads");
  });
  it("kind is a function of season, day and tier, never the island rng", () => {
    const st = fresh();
    st.tier = 1;
    st.day = 4;
    const rng = st.rngS;
    const before = hashState(st);
    const k = raidKind(st);
    duskHint(st);
    expect(st.rngS).toBe(rng);
    expect(hashState(st)).toBe(before);
    const st2 = cloneState(st);
    expect(raidKind(st2)).toBe(k);
  });
  it("every kind and band has 4-5 short lines", () => {
    for (const kind of Object.keys(LINES) as (keyof typeof LINES)[]) {
      for (const band of ["light", "even", "heavy"] as const) {
        const bank = LINES[kind][band];
        expect(bank.length, `${kind}/${band}`).toBeGreaterThanOrEqual(4);
        expect(bank.length).toBeLessThanOrEqual(5);
        expect(new Set(bank).size).toBe(bank.length);
        for (const line of bank) expect(line).not.toMatch(/\d/);
      }
    }
    expect(HIDDEN.length).toBeGreaterThanOrEqual(4);
  });
});

describe("stealth (ghosts)", () => {
  it("hides the approach until an Observatory or an upgraded Watchtower spots it", () => {
    const st = fresh();
    st.hours = 2000;
    st.tier = 1;
    onKind(st, "ghosts", 4);
    expect(raidKind(st)).toBe("ghosts");
    expect(canSpot(st)).toBe(false);
    expect(stealthHidden(st)).toBe(true);
    const h = duskHint(st);
    expect(h.hidden).toBe(true);
    expect(HIDDEN).toContain(h.line);
    expect(h.range![1] / Math.max(1, h.range![0])).toBeGreaterThan(1.5);
    const k = lot(st);
    E.build(st, k, "tower");
    expect(stealthHidden(st)).toBe(true);
    st.lots[k]!.n = 3;
    expect(canSpot(st)).toBe(true);
    expect(stealthHidden(st)).toBe(false);
    expect(duskHint(st).hidden).toBe(false);
    expect(LINES.ghosts[duskHint(st).band!]).toContain(duskHint(st).line);
  });
  it("is usually weaker than a longboat of the same roll", () => {
    const st = fresh();
    st.hours = 2000;
    st.tier = 1;
    onKind(st, "ghosts", 4);
    const a = E.fight(cloneState(st), "hold", 100);
    onKind(st, "longboats", 2);
    const b = E.fight(cloneState(st), "hold", 100);
    expect(a.S).toBeLessThan(b.S);
    expect(a.S).toBe(80);
    expect(b.S).toBe(100);
  });
});

describe("tactics and rewards", () => {
  function armed(): IslandState {
    const st = fresh();
    st.hours = 2000;
    E.build(st, "pal", "palisade");
    E.upgrade(st, "pal");
    E.build(st, "3,3", "field");
    E.upgrade(st, "3,3");
    const back = lot(st);
    E.build(st, back, "workshop");
    for (let i = 0; i < 3; i++) E.upgrade(st, back);
    st.debt = 1;
    return st;
  }
  it("skiffs steal hours and hit little; longboats keep the old grey-first fight", () => {
    const st = armed();
    onKind(st, "skiffs", 4);
    const sk = E.fight(cloneState(st), "hold", 400);
    onKind(st, "longboats", 2);
    const lb = E.fight(cloneState(st), "hold", 400);
    expect(sk.won).toBe(false);
    expect(lb.won).toBe(false);
    expect(sk.damaged.filter((d) => d.k !== "pal").length).toBeLessThanOrEqual(2);
    expect(lb.damaged.length).toBeGreaterThan(sk.damaged.length);
    expect(sk.stolen).toBeGreaterThan(lb.stolen);
    expect(sk.kind).toBe("skiffs");
    expect(lb.kind).toBe("longboats");
    expect(lb.damaged[0].k).toBe("3,3");
  });
  it("fast skiffs (runners) hit grey land extra", () => {
    const st = armed();
    st.tier = 1;
    onKind(st, "runners", 4);
    const ev = E.fight(st, "hold", 400);
    expect(ev.kind).toBe("runners");
    expect(ev.won).toBe(false);
    const greyHits = ev.damaged.filter((d) => d.k === "3,3").length;
    expect(greyHits).toBeGreaterThanOrEqual(1);
  });
  it("siege longboats target the palisade first", () => {
    const st = armed();
    st.tier = 2;
    onKind(st, "siege", 2);
    const palN = st.pal!.n;
    const ev = E.fight(st, "hold", 500);
    expect(ev.kind).toBe("siege");
    expect(ev.damaged[0]).toEqual({ k: "pal", type: "palisade", levels: 1 });
    expect(st.pal!.n).toBe(palN - 1);
  });
  it("rams target the highest-level building, not grey first", () => {
    const st = armed();
    st.tier = 2;
    onKind(st, "rams", 4);
    const back = E.blds(st).find(([, b]) => b.type === "workshop")![0];
    const ev = E.fight(st, "hold", 500);
    expect(ev.kind).toBe("rams");
    expect(ev.damaged[0].k).toBe(back);
  });
  it("held nights pay type-specific salvage", () => {
    const st = armed();
    E.build(st, lot(st), "tower");
    onKind(st, "skiffs", 4);
    const sk = E.fight(cloneState(st), "hold", 1);
    st.tier = 1;
    onKind(st, "ghosts", 4);
    const gh = E.fight(cloneState(st), "hold", 1);
    expect(sk.won).toBe(true);
    expect(gh.won).toBe(true);
    expect(sk.loot).toBeGreaterThan(gh.loot);
  });
  it("City ironclads hit harder; meters steal more hours", () => {
    const st = armed();
    st.tier = 3;
    onKind(st, "ironclads", 2);
    const iron = E.fight(cloneState(st), "hold", 400);
    onKind(st, "meters", 2);
    const met = E.fight(cloneState(st), "hold", 400);
    expect(iron.kind).toBe("ironclads");
    expect(met.kind).toBe("meters");
    expect(iron.S).toBeGreaterThan(met.S);
    expect(met.stolen).toBeGreaterThan(iron.stolen);
  });
  it("the prototype ruleset ignores type tactics (parity)", () => {
    const st = armed();
    onKind(st, "skiffs", 4);
    useRuleset("prototype");
    const proto = E.fight(cloneState(st), "hold", 400);
    useRuleset("phase1");
    onKind(st, "longboats", 2);
    const classic = E.fight(cloneState(st), "hold", 400);
    useRuleset("prototype");
    const protoLb = E.fight(cloneState(st), "hold", 400);
    useRuleset("phase1");
    expect(proto.stolen).toBe(protoLb.stolen);
    expect(proto.damaged.length).toBe(classic.damaged.length);
    expect(TACTICS.skiffs.maxHits).toBe(2);
  });
});
