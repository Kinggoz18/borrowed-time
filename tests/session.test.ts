import { describe, expect, it } from "vitest";
import { verify } from "../src/core/game";
import { SAVE_KEY } from "../src/core/save";
import { hashState } from "../src/core/snapshot";
import { BASE_DAY } from "../src/core/rules";
import { BASE_HOUR_MS, FAST, GAME_SPEED, HOUR_MS, Session } from "../src/game/session";
import { MemoryKV, type KV } from "../src/platform/storage";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("session", () => {
  it("runs at 0.7x the old clock, with a day of BASE_DAY hours and a Rest that follows it", () => {
    expect(GAME_SPEED).toBe(0.7);
    expect(HOUR_MS).toBe(Math.round(BASE_HOUR_MS / 0.7));
    expect(HOUR_MS).toBeGreaterThan(BASE_HOUR_MS);
    expect(BASE_DAY).toBe(12);
    expect(FAST).toBe(BASE_DAY);
    const s = Session.fresh(4, new MemoryKV(), "Test");
    expect(s.state.dayLen).toBe(BASE_DAY);
  });
  it("the clock ticks whole hours by real time, fast when resting, and stops at dusk", () => {
    const s = Session.fresh(4, new MemoryKV(), "Test");
    s.update(HOUR_MS * 2.5);
    expect(s.state.hour).toBe(2);
    s.speed = FAST;
    s.update(HOUR_MS / FAST * 8);
    expect(s.state.hour).toBe(10);
    s.update(HOUR_MS * 100);
    expect(s.state.phase).toBe("dusk");
    expect(s.state.hour).toBe(s.state.dayLen);
  });
  it("paused sessions don't tick", () => {
    const s = Session.fresh(4, new MemoryKV(), "Test");
    s.paused = true;
    s.update(HOUR_MS * 5);
    expect(s.state.hour).toBe(0);
  });
  it("refused commands return null and change nothing", () => {
    const s = Session.fresh(4, new MemoryKV(), "Test");
    const h = hashState(s.state);
    expect(s.do({ t: "build", type: "lantern" })).toBeNull();
    expect(hashState(s.state)).toBe(h);
  });
  it("saves after commands and resumes mid-day with the same island", async () => {
    const kv = new MemoryKV();
    const s = Session.fresh(9, kv, "Haven");
    s.do({ t: "borrow", x: 10 });
    s.do({ t: "build", type: "palisade" });
    s.update(HOUR_MS * 3);
    await flush();
    const back = (await Session.load(kv))!;
    expect(back).not.toBeNull();
    expect(hashState(back.state)).toBe(hashState(s.state));
    expect(back.state.hour).toBe(3);
    expect(back.meta.colonyName).toBe("Haven");
    expect(verify(back.data)).toBe(true);
  });
  it("a blocked storage never throws; the session keeps playing and reports it", async () => {
    const broken: KV = { kind: "broken", get: async () => null, set: async () => false, del: async () => undefined };
    const s = Session.fresh(2, broken, "Test");
    expect(s.do({ t: "hour" })).not.toBeNull();
    expect(await s.save()).toBe(false);
    expect(s.lastSaveOk).toBe(false);
  });
  it("a corrupt save loads as null (start fresh)", async () => {
    const kv = new MemoryKV();
    await kv.set(SAVE_KEY, "{not json");
    expect(await Session.load(kv)).toBeNull();
  });
});
