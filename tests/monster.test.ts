import { describe, expect, it } from "vitest";
import { battleTimeline } from "../src/render/island/battle";
import { arrowCount, MONSTER_FRAMES, monsterFrame, monsterPose, monsterSize } from "../src/render/island/monster";
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
});
