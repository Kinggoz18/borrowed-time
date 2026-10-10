import { describe, expect, it } from "vitest";
import { dispatch, newData } from "../src/core/game";
import * as E from "../src/core/engine";
import { decodeSave, defaultMeta, encodeSave, SAVE_VERSION, seedFirsts } from "../src/core/save";
import { hashState } from "../src/core/snapshot";
import { LocalKV, MemoryKV } from "../src/platform/storage";

const meta = defaultMeta({ introDone: true, storyDone: true, colonyName: "Margery's Rest", savedAt: 1 });

describe("save file", () => {
  it("round-trips mid-day, including the rng state and logs", () => {
    const g = newData(12);
    dispatch(g, { t: "borrow", x: 10 });
    dispatch(g, { t: "build", type: "palisade" });
    dispatch(g, { t: "hour" });
    const f = decodeSave(encodeSave(g, meta))!;
    expect(f.v).toBe(SAVE_VERSION);
    expect(hashState(f.data.state)).toBe(hashState(g.state));
    expect(f.data.commands).toHaveLength(3);
    // the restored island plays on identically
    dispatch(g, { t: "hour" });
    dispatch(f.data, { t: "hour" });
    expect(hashState(f.data.state)).toBe(hashState(g.state));
  });
  it("drops stale, foreign, newer or corrupt saves without throwing", () => {
    expect(decodeSave(null)).toBeNull();
    expect(decodeSave("{nope")).toBeNull();
    expect(decodeSave(JSON.stringify({ v: 1, data: { state: { L: "x" } } }))).toBeNull();
    expect(decodeSave(JSON.stringify({ v: 99, data: {} }))).toBeNull();
    expect(decodeSave(JSON.stringify({ lots: {}, L: 1 }))).toBeNull();
  });
  it("migrates a v0 save", () => {
    const g = newData(3);
    const f = decodeSave(JSON.stringify({ state: g.state, islandId: "abc" }))!;
    expect(f.v).toBe(SAVE_VERSION);
    expect(f.data.islandId).toBe("abc");
    expect(hashState(f.data.state)).toBe(hashState(g.state));
  });
  it("migrates v1 to v2 with defaults and seeds firsts from the island", () => {
    const g = newData(8);
    dispatch(g, { t: "borrow", x: 10 });
    const v1 = {
      v: 1,
      data: g,
      meta: { introDone: true, storyDone: true, colonyName: "New Patience", savedAt: 5 },
    };
    const f = decodeSave(JSON.stringify(v1))!;
    expect(f.v).toBe(2);
    expect(f.meta.colonyName).toBe("New Patience");
    expect(f.meta.goalsDone).toEqual([]);
    expect(f.meta.calledDay).toBe(0);
    expect(f.meta.firsts).toContain("borrow");
    expect(hashState(f.data.state)).toBe(hashState(g.state));
    expect(f.data.commands).toEqual(g.commands);
  });
  it("ignores unknown meta keys on load", () => {
    const g = newData(2);
    const raw = JSON.parse(encodeSave(g, meta)) as Record<string, unknown>;
    (raw.meta as Record<string, unknown>).futureField = { x: 1 };
    const f = decodeSave(JSON.stringify(raw))!;
    expect(f.meta.colonyName).toBe("Margery's Rest");
    expect((f.meta as Record<string, unknown>).futureField).toBeUndefined();
  });
  it("seedFirsts marks raid and held after fights", () => {
    const g = newData(4);
    const st = g.state;
    st.stats.raidsWon = 1;
    expect(seedFirsts(g)).toEqual(expect.arrayContaining(["raid", "held"]));
    st.stats.raidsWon = 0;
    st.stats.raidsLost = 1;
    expect(seedFirsts(g)).toContain("raid");
    expect(seedFirsts(g)).not.toContain("held");
  });
  it("seedFirsts marks grey after borrowed shore", () => {
    const g = newData(4);
    dispatch(g, { t: "borrow", x: 5 });
    expect(E.greyCount(g.state)).toBeGreaterThan(0);
    expect(seedFirsts(g)).toContain("grey");
  });
});

describe("storage adapters never throw", () => {
  it("memory", async () => {
    const kv = new MemoryKV();
    await kv.set("a", "1");
    expect(await kv.get("a")).toBe("1");
  });
  it("blocked localStorage", async () => {
    const blocked = {
      getItem() { throw new Error("SecurityError"); },
      setItem() { throw new Error("QuotaExceeded"); },
      removeItem() { throw new Error("SecurityError"); },
    } as unknown as Storage;
    const kv = new LocalKV(blocked);
    expect(await kv.get("a")).toBeNull();
    expect(await kv.set("a", "1")).toBe(false);
    await expect(kv.del("a")).resolves.toBeUndefined();
  });
});
