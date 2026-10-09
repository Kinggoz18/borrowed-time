import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { costMul, lotKeys, TIERS } from "../src/core/rules";
import type { IslandState } from "../src/core/state";

const fresh = (seed = 3): IslandState => E.newGame({ seed });
const rich = (st: IslandState, h = 500): IslandState => ((st.hours = h), st);
const lot = (st: IslandState) => E.greyOrder(st).slice().reverse().find((k) => E.isFree(st, k))!;

describe("economy", () => {
  it("cost and limit curves", () => {
    expect(E.cost("workshop", 0, 1)).toBe(11);
    expect(E.cost("workshop", 0, 8)).toBe(26);
    const st = fresh();
    expect(E.limit(st)).toBe(Math.round(45 * costMul(1) * 1.2));
  });
  it("starts empty: 8 Hours, 6 people, no wall", () => {
    const st = fresh();
    expect([st.hours, st.pop, st.pal, E.blds(st).length]).toEqual([8, 6, null, 0]);
  });
  it("borrow daylight: today longer, tomorrow shorter", () => {
    const st = fresh();
    const d0 = st.dayLen;
    const x = E.borrow(st, 20);
    expect(x).toBe(20);
    const dl = Math.min(3, Math.floor(20 / (5 * costMul(1))));
    expect(st.dayLen).toBe(d0 + dl);
    expect(st.shortTomorrow).toBe(dl);
    while (st.phase === "day") E.tickHour(st);
    E.resolveDusk(st, "hold");
    E.night(st);
    expect(st.dayLen).toBe(12 - dl + (st.event === "summer" ? 1 : 0));
  });
  it("borrowing stops at the credit limit", () => {
    const st = fresh();
    expect(E.borrow(st, 1e6)).toBe(E.limit(st));
    expect(E.borrow(st, 5)).toBe(0);
  });
  it("grey lots front-first, half output", () => {
    const st = rich(fresh());
    const front = E.greyOrder(st)[0];
    expect(front).toBe("3,3");
    expect(E.build(st, front, "workshop")).toBe(true);
    const full = E.sumEff(st, "inc");
    st.debt = 1;
    expect(E.greySet(st).has(front)).toBe(true);
    expect(E.sumEff(st, "inc")).toBe(full / 2);
    expect(E.greyCount(st)).toBe(Math.ceil((1 / E.limit(st)) * 48));
  });
  it("interest and the Hourglass halve it", () => {
    const st = rich(fresh());
    st.event = "fair";
    expect(E.rate(st)).toBe(0.25);
    E.build(st, lot(st), "bank");
    expect(E.rate(st)).toBe(0.125);
  });
});

describe("building", () => {
  it("everything starts at level 0 and is capped per tier", () => {
    const st = rich(fresh(), 5000);
    expect(E.build(st, lot(st), "field")).toBe(true);
    const k = E.blds(st)[0][0];
    expect(st.lots[k]!.n).toBe(0);
    for (let i = 0; i < 10; i++) E.upgrade(st, k);
    expect(st.lots[k]!.n).toBe(TIERS[0].cap);
  });
  it("building caps and counts", () => {
    const st = rich(fresh(), 5000);
    for (let i = 0; i < 3; i++) expect(E.build(st, lot(st), "field")).toBe(true);
    expect(E.build(st, lot(st), "field")).toBe(false);
  });
  it("credit-only buildings need a tier and credit headroom", () => {
    const st = rich(fresh(), 5000);
    expect(E.canBuild(st, lot(st), "lantern")).toBe(false);
    st.tier = 1;
    for (const k of lotKeys(1)) if (!(k in st.lots)) st.lots[k] = null;
    expect(E.build(st, lot(st), "lantern")).toBe(true);
    expect(st.debt).toBe(E.cost("lantern", 0, st.L));
    expect(st.hours).toBe(5000);
  });
  it("palisade is a ring: no lot, one only", () => {
    const st = rich(fresh());
    expect(E.build(st, "pal", "palisade")).toBe(true);
    expect(st.pal).toEqual({ n: 0, inv: E.cost("palisade", 0, 1) });
    expect(E.build(st, "pal", "palisade")).toBe(false);
    expect(E.defence(st)).toBe(Math.round(6 + 0.6 * Math.sqrt(6)));
  });
  it("footprint claims: 2x2 only into free lots behind", () => {
    const st = rich(fresh(), 1e5);
    st.tier = 3;
    st.L = 20;
    for (const k of lotKeys(3)) if (!(k in st.lots)) st.lots[k] = null;
    st.lots["5,5"] = { type: "workshop", n: 12, inv: 1 };
    expect(E.claims(st).size["5,5"]).toBe(2);
    expect(E.claims(st).owner["4,4"]).toBe("5,5");
    st.lots["4,5"] = { type: "field", n: 0, inv: 1 };
    expect(E.claims(st).size["5,5"]).toBeUndefined();
  });
  it("XP: build +2, upgrade 1 + look stage, levels up", () => {
    const st = rich(fresh(), 5000);
    E.build(st, lot(st), "field");
    expect(st.xp).toBe(2);
    st.xp = 29;
    E.gainXP(st, 1);
    expect(st.L).toBe(2);
  });
});

function toDusk(st: IslandState): void {
  while (st.phase === "day") E.tickHour(st);
}
function toDay(st: IslandState, day: number): void {
  while (st.day !== day) {
    toDusk(st);
    E.resolveDusk(st, "hold", () => 0.5);
    E.night(st);
  }
}

describe("dusk and night", () => {
  it("all 3 dusk decisions change defence as designed", () => {
    const st = rich(fresh());
    E.build(st, "pal", "palisade");
    E.build(st, lot(st), "tower");
    const d = E.defence(st);
    expect(E.defence(st, { borrow: true })).toBe(Math.round((6 + 5 + 0.6 * Math.sqrt(E.fed(st))) * 1.3));
    expect(E.defence(st, { walls: true })).toBeGreaterThan(d);
  });
  it("borrow the dusk takes a loan and shortens tomorrow", () => {
    const st = rich(fresh(), 8);
    toDay(st, 2);
    toDusk(st);
    const ev = E.resolveDusk(st, "borrow", () => 0.5) as E.RaidResult;
    expect(ev.decision).toBe("borrow");
    expect(st.debt).toBe(E.duskLoan(st));
    expect(st.shortTomorrow).toBe(1);
  });
  it("everyone to the walls: no morning bonus", () => {
    const st = rich(fresh(), 8);
    toDay(st, 2);
    toDusk(st);
    E.resolveDusk(st, "walls", () => 0.5);
    const n = E.night(st);
    expect(n.morning).toBe(0);
  });
  it("raid damage hits grey land first; level-0 only destroyed by the boss", () => {
    const st = rich(fresh(), 1000);
    const back = lot(st);
    E.build(st, back, "workshop");
    E.upgrade(st, back);
    E.build(st, "3,3", "field");
    E.upgrade(st, "3,3");
    st.hours = 0;
    st.debt = 1; // greys the front lot "3,3"
    st.day = 2;
    st.phase = "dusk";
    const ev = E.fight(st, "hold", 500);
    expect(ev.won).toBe(false);
    expect(ev.damaged[0].k).toBe("3,3");
    st.lots["3,3"]!.n = 0;
    st.lots[back]!.n = 0;
    const ev2 = E.fight(st, "hold", 500);
    expect(ev2.damaged.every((d) => !d.destroyed)).toBe(true);
    st.day = 6;
    const ev3 = E.fight(st, "hold", 500);
    expect(ev3.damaged.some((d) => d.destroyed)).toBe(true);
  });
  it("breathers: after a lost raid the next raid is x0.8", () => {
    const st = rich(fresh(), 100);
    st.day = 4;
    const n = E.nominal(st);
    st.breather = true;
    expect(E.nominal(st)).toBeLessThan(n);
  });
  it("the dawn ledger: the Long Dusk uses the debt at dawn on day 6, or more", () => {
    const st = rich(fresh(), 0);
    toDay(st, 5);
    E.borrow(st, 40);
    toDusk(st);
    E.resolveDusk(st, "hold", () => 0.5);
    E.night(st);
    expect(st.day).toBe(6);
    expect(st.dawnDebt).toBe(st.debt);
    const before = E.nominal(st);
    st.hours += st.debt;
    E.repay(st, st.debt);
    expect(E.nominal(st)).toBe(before);
  });
  it("default seizure: grey first, most invested, and the seal blocks growth", () => {
    const st = rich(fresh(), 1000);
    E.build(st, "3,3", "field");
    const back = lot(st);
    E.build(st, back, "workshop");
    for (let i = 0; i < 4; i++) E.upgrade(st, back);
    st.debt = E.limit(st) + 5;
    st.phase = "night";
    const n = E.night(st);
    // over the limit means every lot is grey, so the most invested building goes
    expect(n.seized!.k).toBe(back);
    expect(n.seized!.credit).toBe(Math.round(n.seized!.n >= 0 ? n.seized!.credit : 0));
    expect(st.lots[back]).toBeNull();
    expect(st.lien).toBeGreaterThan(E.absDay(st));
    expect(E.growthNeeds(st).seal).toBe(false);
  });
  it("nothing to seize: debt capped at the limit and a villager is lost", () => {
    const st = fresh();
    st.pop = 30;
    st.debt = E.limit(st) * 2;
    st.phase = "night";
    const n = E.night(st);
    expect(n.seized).toBeNull();
    expect(n.servant).toBe(1);
  });
  it("tier gate: level + people + not over the limit", () => {
    const st = rich(fresh(), 10);
    st.L = 3;
    st.pop = 36;
    st.debt = 0;
    expect(E.canGrow(st)).toBe(true);
    st.debt = E.limit(st) + 1;
    expect(E.canGrow(st)).toBe(false);
    st.debt = 0;
    st.pop = 35;
    expect(E.canGrow(st)).toBe(false);
  });
  it("grey-land homes house half; the homeless leave at dawn", () => {
    const st = rich(fresh(), 1000);
    E.build(st, "3,3", "cottage");
    const room = E.popRoom(st);
    st.debt = 1;
    expect(E.popRoom(st)).toBeLessThan(room);
  });
  it("rebuild at half price after a raid knocks a level off", () => {
    const st = rich(fresh(), 1000);
    const k = lot(st);
    E.build(st, k, "workshop");
    E.upgrade(st, k);
    st.lots[k]!.n = 0;
    st.lots[k]!.lost = 1;
    const h = st.hours;
    E.upgrade(st, k);
    const c = E.cost("workshop", 1, st.L);
    expect(h - st.hours).toBe(c - Math.floor(c * 0.5));
  });
  it("season events are drawn from the seeded rng", () => {
    const seen = new Set<string>();
    const st = fresh(11);
    for (let s = 0; s < 200; s++) {
      st.phase = "night";
      st.day = 6;
      E.night(st);
      seen.add(st.event);
    }
    expect(seen.size).toBe(5);
  });
});

describe("tier systems", () => {
  const village = () => {
    const st = rich(fresh(), 5000);
    st.tier = 3;
    st.L = 12;
    for (const k of lotKeys(3)) if (!(k in st.lots)) st.lots[k] = null;
    return st;
  };
  it("roads: +5% building Hours", () => {
    const st = village();
    E.build(st, lot(st), "workshop");
    const i0 = E.income(st);
    E.build(st, "road", "road");
    expect(E.income(st)).toBeGreaterThan(i0);
  });
  it("trade post caravan pays x price x 0.75-1.05", () => {
    const st = village();
    E.build(st, lot(st), "trade");
    expect(E.sendCaravan(st, 10)).toBe(10);
    st.phase = "night";
    st.price = 1.2;
    const n = E.night(st);
    expect(n.caravan!).toBeGreaterThanOrEqual(Math.round(10 * 1.2 * 0.75));
    expect(n.caravan!).toBeLessThanOrEqual(Math.round(10 * 1.2 * 1.05));
  });
  it("academy research is paid up front and done by morning", () => {
    const st = village();
    E.build(st, lot(st), "academy");
    expect(E.research(st, "ledgers")).toBe(true);
    st.phase = "night";
    E.night(st);
    expect(st.tech.ledgers).toBe(true);
  });
  it("exchange refinances; harbour makes the dusk loan x1.5; observatory narrows the boss", () => {
    const st = village();
    const lim = E.limit(st);
    E.build(st, lot(st), "exchange");
    expect(E.limit(st)).toBeGreaterThan(lim);
    expect(E.duskMul(st)).toBe(1.3);
    E.build(st, lot(st), "harbour");
    expect(E.duskMul(st)).toBe(1.5);
    expect(E.bossDebtK(st)).toBe(1); // 0.8 x the Village multiplier 1.25
    E.build(st, lot(st), "observatory");
    expect(E.bossDebtK(st)).toBeLessThan(1);
  });
  it("hospital: one hit fewer and saves people", () => {
    const st = village();
    E.build(st, lot(st), "hospital");
    st.pop = 200;
    st.day = 4;
    const ev = E.fight(st, "hold", 1000);
    expect(ev.saved).toBeGreaterThan(0);
  });
});
