import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { apply, CommandError, dispatch, newData, replay, verify } from "../src/core/game";
import { LANDMARKS, plazaKey } from "../src/core/landmarks";
import { decodeSave, encodeSave } from "../src/core/save";
import { hashState, cloneState } from "../src/core/snapshot";
import { lotKeys } from "../src/core/rules";
import type { IslandState } from "../src/core/state";

const at = (tier: number): IslandState => {
  const st = E.newGame({ seed: 5 });
  st.tier = tier;
  for (const k of lotKeys(tier)) if (!(k in st.lots)) st.lots[k] = null;
  st.hours = 5000;
  return st;
};
const free = (st: IslandState, n = 0): string => Object.keys(st.lots).filter((k) => k !== "0,0" && E.isFree(st, k))[n];

describe("landmarks (cosmetic, placed by the player)", () => {
  it("three unlock at Town, three more at City, none before", () => {
    expect(E.unlockedLandmarks(at(1))).toHaveLength(0);
    expect(E.unlockedLandmarks(at(2)).map((l) => l.id)).toEqual(["clock", "wreck", "bargain"]);
    expect(E.unlockedLandmarks(at(3))).toHaveLength(6);
    expect(LANDMARKS.every((l) => l.plaque.length > 20)).toBe(true);
  });
  it("a new game has none placed and the field stays absent from the state", () => {
    expect(at(2).landmarks).toBeUndefined();
    expect("landmarks" in at(2)).toBe(false);
  });
  it("places one of each on a free lot or a plaza tile; a locked one is refused", () => {
    const st = at(2);
    const a = free(st);
    expect(E.placeLandmark(st, "clock", a)).toBe(true);
    expect(E.isFree(st, a)).toBe(false);
    expect(E.placeLandmark(st, "wreck", a)).toBe(false); // the lot is taken
    expect(E.placeLandmark(st, "dial", free(st))).toBe(false); // City only
    expect(E.placeLandmark(st, "nope", free(st))).toBe(false);
    const plaza = E.plazaSpots(st)[0];
    expect(E.placeLandmark(st, "wreck", plaza)).toBe(true);
    expect(E.placeLandmark(st, "bargain", plaza)).toBe(false);
  });
  it("a building cannot go on a landmark's lot, and the build command skips it", () => {
    const st = at(2);
    const a = free(st);
    E.placeLandmark(st, "clock", a);
    expect(E.build(st, a, "cottage")).toBe(false);
    st.hours = 5000;
    expect(E.canBuild(st, a, "cottage")).toBe(false);
  });
  it("a landmark moves for free, to another free spot, and gives its old lot back", () => {
    const st = at(2);
    const a = free(st), b = free(st, 1);
    E.placeLandmark(st, "clock", a);
    const h = st.hours;
    expect(E.placeLandmark(st, "clock", b)).toBe(true);
    expect(st.hours).toBe(h);
    expect(E.isFree(st, a)).toBe(true);
    expect(E.isFree(st, b)).toBe(false);
  });
  it("plaza tiles are street crossings inside the built area, never on the avenue to the gate", () => {
    const st = at(2);
    const spots = E.plazaSpots(st);
    expect(spots.length).toBeGreaterThan(8);
    expect(spots).toContain(plazaKey(-2, -2));
    expect(spots.some((k) => k.endsWith(",2"))).toBe(false);
    expect(E.plazaSpots(at(3)).length).toBeGreaterThan(spots.length);
  });
  it("only in daylight", () => {
    const st = at(2);
    st.phase = "dusk";
    expect(E.placeLandmark(st, "clock", free(st))).toBe(false);
  });
  it("commands replay and save: the placement survives, the log verifies", () => {
    const g = newData(9);
    g.state = at(2);
    g.checkpoint = cloneState(g.state);
    const a = free(g.state);
    dispatch(g, { t: "landmark", id: "bargain", at: a });
    expect(verify(g)).toBe(true);
    const f = decodeSave(encodeSave(g, { introDone: true, storyDone: true, colonyName: "x", savedAt: 1 }))!;
    expect(f.data.state.landmarks).toEqual({ bargain: a });
    expect(hashState(f.data.state)).toBe(hashState(g.state));
    expect(() => apply(cloneState(g.state), { t: "landmark", id: "clock", at: a })).toThrow(CommandError);
  });
  it("old saves (no field) load as all unplaced; broken placements are dropped", () => {
    const g = newData(9);
    g.state = at(2);
    g.checkpoint = cloneState(g.state);
    const old = decodeSave(encodeSave(g, { introDone: true, storyDone: true, colonyName: "x", savedAt: 1 }))!;
    expect(old.data.state.landmarks).toBeUndefined();
    const bad = cloneState(g.state);
    bad.landmarks = { clock: "99,99", dial: free(bad), wreck: "p:2,2", ghost: "p:2,2" };
    g.state = bad;
    const f = decodeSave(encodeSave(g, { introDone: true, storyDone: true, colonyName: "x", savedAt: 1 }))!;
    expect(f.data.state.landmarks).toEqual({ wreck: "p:2,2" });
  });
  it("does not change the state hash of games that never place one", () => {
    const st = at(2);
    const h = hashState(st);
    E.placeLandmark(st, "clock", free(st));
    expect(hashState(st)).not.toBe(h);
    E.removeLandmark(st, "clock");
    expect(hashState(st)).toBe(h);
  });
});

describe("moving a building", () => {
  const withBld = (): { st: IslandState; from: string } => {
    const st = at(1);
    const from = free(st);
    expect(E.build(st, from, "workshop")).toBe(true);
    E.upgrade(st, from);
    E.upgrade(st, from);
    return { st, from };
  };
  it("moves to a free lot for a quarter of the first-level cost, keeping level and history", () => {
    const { st, from } = withBld();
    const b = { ...st.lots[from]! };
    const to = free(st);
    const fee = E.moveFee(st, from);
    expect(fee).toBe(Math.max(1, Math.round(0.25 * E.cost("workshop", 0, st.L))));
    const h = st.hours;
    expect(E.moveBuilding(st, from, to)).toBe(true);
    expect(st.hours).toBe(h - fee);
    expect(st.lots[from]).toBeNull();
    expect(st.lots[to]).toEqual(b);
    expect(E.income(st)).toBeGreaterThan(0);
  });
  it("keeps the lot table's key order (it is part of the state)", () => {
    const { st, from } = withBld();
    const keys = Object.keys(st.lots);
    E.moveBuilding(st, from, free(st));
    expect(Object.keys(st.lots)).toEqual(keys);
  });
  it("refused: dusk, night, a taken lot, the same lot, too few Hours, a landmark's lot, an empty lot", () => {
    const { st, from } = withBld();
    const to = free(st);
    expect(E.moveBlock(st, from, from)).toBe("same");
    expect(E.moveBlock(st, to)).toBe("none");
    const other = free(st, 1);
    E.build(st, other, "cottage");
    expect(E.moveBlock(st, from, other)).toBe("taken");
    E.placeLandmark(st, "clock", to);
    st.tier = 2;
    for (const k of lotKeys(2)) if (!(k in st.lots)) st.lots[k] = null;
    E.placeLandmark(st, "clock", to);
    expect(E.moveBlock(st, from, to)).toBe("taken");
    const t = free(st);
    st.hours = 0;
    expect(E.moveBlock(st, from, t)).toBe("hours");
    st.hours = 100;
    st.phase = "dusk";
    expect(E.moveBlock(st, from, t)).toBe("night");
    st.phase = "night";
    expect(E.moveBuilding(st, from, t)).toBe(false);
  });
  it("roads and the palisade are not on a lot, so they have nothing to move", () => {
    const st = at(1);
    E.build(st, undefined, "palisade");
    expect(E.moveBlock(st, "pal", free(st))).toBe("none");
  });
  it("is a command: replays exactly and logs a 'moved' event", () => {
    const g = newData(4);
    g.state.hours = 500;
    g.checkpoint = cloneState(g.state);
    const from = free(g.state);
    dispatch(g, { t: "build", type: "cottage", key: from });
    const to = free(g.state);
    const evs = dispatch(g, { t: "move", from, to });
    expect(evs[0]).toMatchObject({ kind: "moved", from, to, type: "cottage" });
    expect(verify(g)).toBe(true);
    expect(hashState(replay(g.checkpoint, g.commands.map(({ seq: _s, ...c }) => c)))).toBe(hashState(g.state));
    expect(() => dispatch(g, { t: "move", from, to })).toThrow(CommandError);
  });
  it("a moved big building frees its footprint behind it", () => {
    const { st, from } = withBld();
    const claims0 = Object.keys(E.claims(st).owner).length;
    for (let i = 0; i < 6; i++) E.upgrade(st, from);
    E.moveBuilding(st, from, free(st));
    expect(Object.keys(E.claims(st).owner).length).toBeLessThanOrEqual(Math.max(claims0, 8));
    expect(E.isFree(st, from)).toBe(true);
  });
});
