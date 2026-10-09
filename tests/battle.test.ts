import { describe, expect, it } from "vitest";
import { BATTLE_RESOLVED_EVENT, battleTimeline, boatCount, raiderCount } from "../src/render/island/battle";

describe("dusk battle sequence", () => {
  it("shows boats, defenders, clash and outcome before the resolved event, then aftermath", () => {
    const beats = battleTimeline({ won: false, boss: false }, false);
    expect(beats.map((b) => b.phase)).toEqual(["approach", "defend", "clash", "outcome", "resolved", "aftermath"]);
    const resolvedAt = beats.findIndex((b) => b.phase === "resolved");
    const aftermathAt = beats.findIndex((b) => b.phase === "aftermath");
    expect(resolvedAt).toBeGreaterThan(beats.findIndex((b) => b.phase === "outcome"));
    expect(aftermathAt).toBeGreaterThan(resolvedAt);
    expect(beats[resolvedAt]!.dur).toBe(0);
    expect(beats.find((b) => b.phase === "aftermath")!.dur).toBeGreaterThan(1);
  });
  it("respects reduced motion: short beats, same order, resolved still fires first", () => {
    const beats = battleTimeline({ won: true, boss: true }, true);
    expect(beats.map((b) => b.phase)).toEqual(["approach", "defend", "clash", "outcome", "resolved", "aftermath"]);
    for (const b of beats) if (b.phase !== "resolved") expect(b.dur).toBeLessThan(0.1);
    expect(BATTLE_RESOLVED_EVENT).toBe("bt:battle-resolved");
  });
  it("ghosts and skiffs bring fewer boats; siege and ironclads bring more", () => {
    expect(boatCount("ghosts", false, 6)).toBe(1);
    expect(boatCount("skiffs", false, 6)).toBe(1);
    expect(boatCount("siege", false, 6)).toBe(3);
    expect(boatCount("ironclads", false, 6)).toBe(3);
    expect(boatCount("longboats", true, 6)).toBe(4);
    expect(raiderCount("ghosts", false, 24)).toBe(3);
    expect(raiderCount("ironclads", false, 24)).toBe(7);
  });
});
