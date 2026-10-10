import { describe, expect, it } from "vitest";
import { AudioGraph, MAX_VOICES, cueJitter, takeVoice } from "../src/platform/audio-graph";
import { LOOP_S, STINGER, palette, score } from "../src/platform/score";
import { Sfx } from "../src/platform/sfx";
import { DEFAULT_SETTINGS, SETTINGS_KEY, clampVol, loadSettings, saveSettings } from "../src/game/settings";
import { MemoryKV } from "../src/platform/storage";

describe("voice cap and cue jitter", () => {
  it("steals the oldest voice when the cap is hit", () => {
    const stopped: number[] = [];
    let slots = takeVoice([], 2, 1, () => stopped.push(1));
    slots = takeVoice(slots, 2, 2, () => stopped.push(2));
    slots = takeVoice(slots, 2, 3, () => stopped.push(3));
    expect(stopped).toEqual([1]);
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.t)).toEqual([2, 3]);
  });
  it("never exceeds MAX_VOICES", () => {
    let slots = takeVoice([], MAX_VOICES, 0, () => undefined);
    for (let i = 1; i < MAX_VOICES + 5; i++) slots = takeVoice(slots, MAX_VOICES, i, () => undefined);
    expect(slots).toHaveLength(MAX_VOICES);
  });
  it("jitter is deterministic and stays in a small band", () => {
    expect(cueJitter("tap", 4)).toEqual(cueJitter("tap", 4));
    expect(cueJitter("tap", 4)).not.toEqual(cueJitter("horn", 4));
    expect(cueJitter("tap", 4)).not.toEqual(cueJitter("tap", 5));
    const j = cueJitter("dusk", 12);
    expect(j.pitch).toBeGreaterThanOrEqual(0.97);
    expect(j.pitch).toBeLessThanOrEqual(1.03);
    expect(j.vol).toBeGreaterThanOrEqual(0.88);
    expect(j.vol).toBeLessThanOrEqual(1.12);
  });
});

describe("synthesised score", () => {
  it("is deterministic and loopable", () => {
    expect(LOOP_S).toBe(16);
    const a = score(0, "day");
    const b = score(0, "day");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const n of a) expect(n.t).toBeLessThan(LOOP_S);
  });
  it("Colony day is Tobias: fiddle, whistle, surf, and some bad cents", () => {
    expect(palette(0, "day")).toEqual(expect.arrayContaining(["fiddle", "whistle", "surf", "drone"]));
    expect(score(0, "day").some((n) => n.inst === "fiddle" && n.detune !== 0)).toBe(true);
    expect(palette(0, "menu")).toEqual(palette(0, "day"));
    const dayG = score(0, "day").find((n) => n.inst === "fiddle")!.gain;
    const menuG = score(0, "menu").find((n) => n.inst === "fiddle")!.gain;
    expect(menuG).toBeLessThan(dayG);
  });
  it("each era has its own day palette", () => {
    expect(palette(1, "day")).toEqual(expect.arrayContaining(["gurdy", "drum", "drone"]));
    expect(palette(2, "day")).toEqual(expect.arrayContaining(["lute", "harpsichord", "tick", "drone"]));
    expect(palette(3, "day")).toEqual(expect.arrayContaining(["brass", "hiss", "drone"]));
    expect(palette(1, "day")).not.toContain("fiddle");
    expect(palette(3, "day")).not.toContain("fiddle");
  });
  it("dusk, raid, Hesper and the tier-up stinger are their own tables", () => {
    expect(palette(0, "dusk")).toEqual(expect.arrayContaining(["bell", "drone"]));
    expect(palette(0, "raid")).toEqual(expect.arrayContaining(["drone", "drum"]));
    expect(palette(0, "raid")).not.toContain("fiddle");
    expect(palette(0, "hesper")).toEqual(expect.arrayContaining(["box", "tick"]));
    expect(STINGER).toHaveLength(4);
    expect(STINGER.every((n) => n.inst === "bell")).toBe(true);
    expect(JSON.stringify(score(2, "hesper"))).toBe(JSON.stringify(score(0, "hesper")));
  });
});

describe("mixer", () => {
  it("ducks stack and never go below zero", () => {
    const g = new AudioGraph();
    g.duck(true);
    g.duck(true);
    expect(g.duckCount).toBe(2);
    g.duck(false);
    expect(g.duckCount).toBe(1);
    g.duck(false);
    g.duck(false);
    expect(g.duckCount).toBe(0);
  });
  it("records cues even when there is no audio device", () => {
    const sfx = new Sfx();
    sfx.play("tap");
    sfx.play("dusk");
    expect(sfx.played).toEqual(["tap", "dusk"]);
  });
});

describe("settings", () => {
  it("clampVol stays in 0–1", () => {
    expect(clampVol(0, 0.5)).toBe(0);
    expect(clampVol(1.4, 0.5)).toBe(1);
    expect(clampVol("nope", 0.65)).toBe(0.65);
  });
  it("defaults music on; a legacy Sound-off mute also mutes music", async () => {
    const kv = new MemoryKV();
    expect(await loadSettings(kv)).toEqual(DEFAULT_SETTINGS);
    await kv.set(SETTINGS_KEY, JSON.stringify({ sound: false, haptics: false }));
    const legacy = await loadSettings(kv);
    expect(legacy.sound).toBe(false);
    expect(legacy.music).toBe(false);
    expect(legacy.musicVol).toBe(DEFAULT_SETTINGS.musicVol);
    await saveSettings(kv, { ...DEFAULT_SETTINGS, music: true, sound: false, musicVol: 0.2 });
    const split = await loadSettings(kv);
    expect(split.music).toBe(true);
    expect(split.sound).toBe(false);
    expect(split.musicVol).toBe(0.2);
  });
  it("keeps orientation from the UI stream and fills mixer volumes", async () => {
    expect(DEFAULT_SETTINGS.orientation).toBe("auto");
    const kv = new MemoryKV();
    await kv.set(SETTINGS_KEY, JSON.stringify({ sound: true, haptics: true, quality: "auto", orientation: "portrait" }));
    const s = await loadSettings(kv);
    expect(s.orientation).toBe("portrait");
    expect(s.music).toBe(true);
    expect(s.musicVol).toBe(DEFAULT_SETTINGS.musicVol);
    expect(s.sfxVol).toBe(DEFAULT_SETTINGS.sfxVol);
  });
  it("fresh installs get Auto layout, and an explicit Landscape choice survives", async () => {
    const fresh = new MemoryKV();
    expect((await loadSettings(fresh)).orientation).toBe("auto");
    const kept = new MemoryKV();
    await kept.set(SETTINGS_KEY, JSON.stringify({ orientation: "landscape" }));
    expect((await loadSettings(kept)).orientation).toBe("landscape");
    const odd = new MemoryKV();
    await odd.set(SETTINGS_KEY, JSON.stringify({ orientation: "sideways" }));
    expect((await loadSettings(odd)).orientation).toBe("auto");
  });
});
