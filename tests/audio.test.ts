import { describe, expect, it } from "vitest";
import { AudioGraph, MAX_VOICES, cueJitter, takeVoice } from "../src/platform/audio-graph";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { CREDITS } from "../src/ui/credits";
import { FADE_S, Music, fadeCurve, pickFormat, trackUrl } from "../src/platform/music";
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

describe("music", () => {
  it("picks Ogg where the browser plays it and AAC otherwise (iOS)", () => {
    expect(pickFormat((m) => (m.includes("vorbis") ? "probably" : ""))).toBe("ogg");
    expect(pickFormat(() => "")).toBe("m4a");
    expect(trackUrl("day", "ogg", "/")).toBe("/audio/day.ogg");
    expect(trackUrl("night", "m4a", "/bt/")).toBe("/bt/audio/night.m4a");
  });
  it("crossfades with equal power: in and out always sum to constant power", () => {
    const up = fadeCurve(64, true), down = fadeCurve(64, false);
    expect(up[0]).toBe(0);
    expect(up[63]).toBeCloseTo(1, 5);
    expect(down[0]).toBe(1);
    expect(down[63]).toBeCloseTo(0, 5);
    for (let i = 0; i < 64; i++) expect(up[i]! ** 2 + down[i]! ** 2).toBeCloseTo(1, 4);
    expect(FADE_S).toBeGreaterThanOrEqual(2);
  });
  it("is safe with no audio device and before the first tap: it only remembers the track", () => {
    const m = new Music();
    m.set("night");
    expect(m.scene).toBe("night");
    expect(m.running).toBe(false);
    m.start();
    expect(m.running).toBe(false);
    m.stop();
  });
  it("ships two looping tracks in both formats, under 2.5 MB together, with no original files in the repo", () => {
    let total = 0;
    for (const t of ["day", "night"])
      for (const ext of ["ogg", "m4a"]) {
        const size = statSync(`public/audio/${t}.${ext}`).size;
        expect(size).toBeGreaterThan(100_000);
        total += size;
      }
    expect(total).toBeLessThan(2.5 * 1024 * 1024);
    const stray = readdirSync("public/audio").filter((f) => !/^(day|night)\.(ogg|m4a)$/.test(f));
    expect(stray).toEqual([]);
  });
  it("credits both artists and Pixabay in docs/CREDITS.md and in the Credits list the Settings screen shows", () => {
    const doc = readFileSync("docs/CREDITS.md", "utf8");
    expect(doc).toContain("Ribhav Agrawal");
    expect(doc).toContain("Bryan Jesus De Los Santos Breton");
    expect(doc).toContain("Pixabay");
    for (const c of CREDITS) {
      expect(doc).toContain(c.artist);
      expect(c.source).toBe("Pixabay");
    }
    expect(CREDITS.map((c) => c.use)).toEqual(["Daytime music", "Night music"]);
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
