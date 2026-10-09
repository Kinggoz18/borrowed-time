import { describe, expect, it } from "vitest";
import { dispatch, newData } from "../src/core/game";
import { decodeSave, encodeSave, SAVE_VERSION } from "../src/core/save";
import { hashState } from "../src/core/snapshot";
import { LocalKV, MemoryKV } from "../src/platform/storage";

const meta = { introDone: true, storyDone: true, colonyName: "Margery's Rest", savedAt: 1 };

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
    expect(f.v).toBe(1);
    expect(f.data.islandId).toBe("abc");
    expect(hashState(f.data.state)).toBe(hashState(g.state));
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
