import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { CommandError, dispatch, newData, replay, verify, type Command } from "../src/core/game";
import { Rng } from "../src/core/rng";
import { B_TYPES } from "../src/core/rules";
import { cloneState, hashSnapshot, hashState, resolveRaid, toSnapshot } from "../src/core/snapshot";

/** A random player: tries random intents; refused ones are simply not logged. */
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
      if (p < 0.5) cmd = { t: "hour" };
      else if (p < 0.7) cmd = { t: "build", type: B_TYPES[Math.floor(r.next() * B_TYPES.length)] };
      else if (p < 0.8) {
        const ks = Object.keys(st.lots).filter((k) => st.lots[k]).concat(st.pal ? ["pal"] : []);
        cmd = ks.length ? { t: "upgrade", key: ks[Math.floor(r.next() * ks.length)] } : { t: "hour" };
      } else if (p < 0.9) cmd = { t: "borrow", x: Math.round(r.next() * 30) };
      else cmd = { t: "repay", x: Math.round(r.next() * 30) };
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

describe("determinism", () => {
  it("same seed + command log => identical IslandSnapshot hash", () => {
    for (const seed of [1, 2, 3]) {
      const { g, all } = play(seed, 3000);
      const again = replay(newData(seed).state, all);
      const a = hashSnapshot(toSnapshot(g.state, g.islandId, g.seq));
      const b = hashSnapshot(toSnapshot(again, g.islandId, g.seq));
      expect(b).toBe(a);
      expect(g.state.season).toBeGreaterThan(2);
    }
  });
  it("replaying from the season checkpoint reproduces the current state", () => {
    const { g } = play(9, 2500);
    expect(g.checkpointSeq).toBeGreaterThan(0);
    expect(verify(g)).toBe(true);
  });
  it("a different seed gives a different island", () => {
    expect(hashState(play(1, 400).g.state)).not.toBe(hashState(play(2, 400).g.state));
  });
  it("the event log is append-only and sequenced", () => {
    const { g } = play(4, 1500);
    const seqs = g.events.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(g.events.some((e) => e.kind === "raid")).toBe(true);
  });
  it("refused commands leave the island unchanged", () => {
    const g = newData(5);
    const h = hashState(g.state);
    expect(() => dispatch(g, { t: "build", type: "lantern" })).toThrow(CommandError);
    expect(hashState(g.state)).toBe(h);
    expect(g.seq).toBe(0);
  });
});

describe("resolveRaid(snapshot, strength, seed)", () => {
  it("is pure and matches the in-game dusk with the same roll", () => {
    const { g } = play(6, 200);
    const st = g.state;
    while (st.phase !== "dusk" || E.dayKind(st.day) === "quiet") {
      if (st.phase === "day") E.tickHour(st);
      else if (st.phase === "dusk") E.resolveDusk(st, "hold");
      else E.night(st);
    }
    for (const decision of ["hold", "borrow", "walls"] as const) {
      const snap = toSnapshot(st, g.islandId, g.seq);
      const before = hashSnapshot(snap);
      const probe = cloneState(st);
      E.applyDecision(probe, decision);
      const nominal = E.nominal(probe);
      const a = resolveRaid(snap, nominal, 77, decision);
      expect(hashSnapshot(snap)).toBe(before);
      const twin = cloneState(st);
      const roll = new Rng(77).next;
      const b = E.resolveDusk(twin, decision, roll) as E.RaidResult;
      expect(a.result.S).toBe(b.S);
      expect(a.result.D).toBe(b.D);
      expect(a.result.damaged).toEqual(b.damaged);
      expect(resolveRaid(snap, nominal, 77, decision).result).toEqual(a.result);
    }
  });
});
