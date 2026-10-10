import { describe, expect, it } from "vitest";
import { battleTimeline } from "../src/render/island/battle";
import { arrowCount, MONSTER_ART_H, MONSTER_ART_W, MONSTER_BASE, MONSTER_FRAMES, MONSTER_SPAN, monsterDread, monsterEyes, monsterFrame, monsterHeight, monsterPose, monsterScale, monsterSize, monsterWidth } from "../src/render/island/monster";
import * as E from "../src/core/engine";
import { layoutIsland } from "../src/render/island/layout";
import { readFileSync } from "node:fs";

describe("the Long Dusk shadow", () => {
  it("grows with the raid's strength: small, medium, large", () => {
    expect(monsterSize(10)).toBe(0);
    expect(monsterSize(60)).toBe(0);
    expect(monsterSize(100)).toBe(1);
    expect(monsterSize(400)).toBe(2);
    let last = 0;
    for (let S = 0; S < 600; S += 10) {
      const k = monsterSize(S);
      expect(k).toBeGreaterThanOrEqual(last);
      last = k;
    }
  });
  it("rises out of the sea in the approach and is fully up for the defence", () => {
    expect(monsterPose("approach", 0, true).rise).toBe(0);
    expect(monsterPose("approach", 1, true).rise).toBe(1);
    expect(monsterPose("defend", 0.5, false).rise).toBe(1);
  });
  it("a held night drives it back under; a lost night leaves it standing, then it thins out", () => {
    expect(monsterPose("outcome", 1, true).rise).toBeLessThan(0.6);
    expect(monsterPose("aftermath", 1, true).rise).toBe(0);
    expect(monsterPose("outcome", 1, false).rise).toBe(1);
    expect(monsterPose("aftermath", 0, false).alpha).toBe(1);
    expect(monsterPose("aftermath", 1, false).alpha).toBe(0);
    for (const ph of battleTimeline({ won: true, boss: true }, false)) expect(monsterPose(ph.phase, 0.5, true).rise).toBeGreaterThanOrEqual(0);
  });
  it("leans over the walls only when the defence fails", () => {
    const lean = [0.1, 0.3, 0.7].map((u) => Math.abs(monsterPose("clash", u, false).lean) + Math.abs(monsterPose("outcome", u, false).lean));
    expect(Math.max(...lean)).toBeGreaterThan(0);
    expect(monsterPose("clash", 0.3, true).lean).toBe(0);
  });
  it("the defence looses more arrows the closer it is to the shadow's strength", () => {
    expect(arrowCount(100, 20, 8)).toBeLessThan(arrowCount(100, 100, 8));
    expect(arrowCount(100, 500, 8)).toBeLessThanOrEqual(8);
    expect(arrowCount(100, 0, 8)).toBeGreaterThanOrEqual(2);
  });
  it("steps through its frames (stepped, never smooth)", () => {
    const seen = new Set([0, 0.2, 0.4, 0.6, 0.8].map(monsterFrame));
    expect(seen.size).toBeGreaterThan(1);
    for (const f of seen) expect(f).toBeLessThan(MONSTER_FRAMES);
  });
  it("every size and frame is in the shared pixel atlas, at both grids, with the arrow", () => {
    for (const sc of ["m", "l"]) {
      const names = Object.keys(JSON.parse(readFileSync(`public/art/${sc}/shared.json`, "utf8")).frames);
      for (let si = 0; si < 3; si++) for (let f = 0; f < MONSTER_FRAMES; f++) expect(names).toContain(`fx/monster/${si}/${f}`);
      expect(names).toContain("fx/arrow");
    }
  });

  it("is sized by the island: the medium shadow spans over half its width and stands taller than the ring", () => {
    const W = 1984; // a fixed island, tier after tier
    for (const unit of [1, 0.5, 2]) {
      const k = monsterScale(W, unit);
      expect(Number.isInteger(k)).toBe(true);
      const w = monsterWidth(1, k, unit);
      expect(w).toBeGreaterThan(W * 0.45);
      expect(w).toBeLessThan(W * MONSTER_SPAN * 1.2);
      expect(monsterWidth(0, k, unit)).toBeLessThan(w);
      expect(monsterWidth(2, k, unit)).toBeGreaterThan(w);
      expect(monsterWidth(2, k, unit)).toBeLessThan(W);
    }
    // a bigger island makes a bigger shadow; the shadow never drops below a visible magnification
    expect(monsterScale(3000, 1)).toBeGreaterThan(monsterScale(1500, 1));
    expect(monsterScale(10, 1)).toBeGreaterThanOrEqual(2);
    expect(monsterHeight(1, 1, 6)).toBe(MONSTER_ART_H[1] * 6);
    expect(MONSTER_ART_W[1]).toBe(190);
    expect(MONSTER_BASE).toBeGreaterThan(0);
  });
  it("towers over the real island and its ring at every age", () => {
    const k = monsterScale(1984, 1);
    for (const tier of [0, 1, 2, 3]) {
      const st = E.newGame({ seed: 1 });
      st.tier = tier;
      st.pal = { n: 0, inv: 1 };
      const lay = layoutIsland(st);
      const k2 = monsterScale(lay.bounds.w, 1);
      expect(k2).toBeGreaterThanOrEqual(2);
      // the shadow stands taller than the whole ring at any age, and spans about half the island
      expect(monsterHeight(1, 1, k2)).toBeGreaterThan(lay.playBounds.h);
      expect(monsterWidth(1, k2, 1)).toBeGreaterThan(lay.bounds.w * 0.45);
    }
    expect(k).toBeGreaterThan(2);
  });
  it("shows its eyes before its body, and darkens the screen as it stands", () => {
    const early = monsterPose("approach", 0.2, true);
    expect(early.rise).toBe(0);
    expect(early.eyes).toBeGreaterThan(0.5);
    expect(monsterPose("approach", 0, true).eyes).toBe(0);
    expect(monsterPose("defend", 0.5, true).eyes).toBe(1);
    expect(monsterDread(monsterPose("approach", 0, true))).toBe(0);
    expect(monsterDread(monsterPose("defend", 0.5, true))).toBeGreaterThan(0.95);
    expect(monsterDread(monsterPose("aftermath", 1, true))).toBe(0);
    expect(monsterDread(monsterPose("aftermath", 1, false))).toBe(0);
    const eye = monsterEyes(1);
    expect(eye.dy).toBeLessThan(-100);
    expect(eye.dx).toBeCloseTo(8.5, 5);
  });
});
