import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { LANDMARKS } from "../src/render/island/landmarks";
import { layoutIsland } from "../src/render/island/layout";

interface Manifest { eras: Record<string, string[]> }
const manifest = JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as Manifest;
const framesOf = (sc: "m" | "l", era: string): Set<string> => {
  const out = new Set<string>();
  for (const set of manifest.eras[era]) for (const n of Object.keys((JSON.parse(readFileSync(`public/art/${sc}/${set}.json`, "utf8")) as { frames: Record<string, unknown> }).frames)) out.add(n);
  return out;
};

describe("street, scenery and landmark art", () => {
  for (const sc of ["m", "l"] as const) {
    it(`${sc}: every era has the dirt track (16 masks), plaza, trees and bushes`, () => {
      for (const era of ["colony", "village", "town", "city"]) {
        const have = framesOf(sc, era);
        for (let m = 0; m < 16; m++) expect(have.has(`st/track/${m}`)).toBe(true);
        for (const f of ["plaza/colony", "sc/tree/0", "sc/tree/3", "sc/bush/0", "sc/bush/2"]) expect(have.has(f)).toBe(true);
      }
    });
    it(`${sc}: village, town and city carry paved street tiles for all 16 masks, two variants, and their plaza`, () => {
      for (const era of ["village", "town", "city"]) {
        const have = framesOf(sc, era);
        for (let m = 0; m < 16; m++) for (let v = 0; v < 2; v++) expect(have.has(`st/${era}/${m}/${v}`)).toBe(true);
        expect(have.has(`plaza/${era}`)).toBe(true);
      }
      expect(framesOf(sc, "town").has("sc/lamp/town")).toBe(true);
      expect(framesOf(sc, "city").has("sc/lamp/city")).toBe(true);
    });
    it(`${sc}: landmarks are lazy-loaded with their era: none before Town, Town's three at Town, all six at City`, () => {
      const ids = (tier: number) => LANDMARKS.filter((l) => l.tier <= tier).map((l) => `land/${l.id}`);
      for (const era of ["colony", "village"]) for (const l of LANDMARKS) expect(framesOf(sc, era).has(`land/${l.id}`)).toBe(false);
      for (const f of ids(2)) expect(framesOf(sc, "town").has(f)).toBe(true);
      for (const l of LANDMARKS.filter((x) => x.tier === 3)) expect(framesOf(sc, "town").has(`land/${l.id}`)).toBe(false);
      for (const f of ids(3)) expect(framesOf(sc, "city").has(f)).toBe(true);
    });
  }
  it("a layout against the real pages draws only frames that exist, and a Town block mixes roof variants", () => {
    for (const [tier, era] of [[0, "colony"], [1, "village"], [2, "town"], [3, "city"]] as const) {
      const have = framesOf("m", era);
      const st = E.newGame({ seed: 5 });
      st.tier = tier;
      st.road = { n: 0, inv: 1 };
      for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) if ((i || j) && Math.max(Math.abs(i), Math.abs(j)) <= [3, 5, 7, 10][tier]) st.lots[`${i},${j}`] = (i + j) % 3 === 0 ? { type: "cottage", n: 7, inv: 1 } : null;
      const lay = layoutIsland(st, { pixel: (f) => have.has(f), era });
      const missing = [...lay.ground, ...lay.things, ...lay.ring].map((p) => p.frame).filter((f) => !have.has(f) && !f.startsWith("grey/") && !f.startsWith("p/") && f !== "tent" && f !== "gnomon" && !f.startsWith("ring/") && !f.startsWith("gate/") && !f.startsWith("g/"));
      expect(missing, era).toEqual([]);
      if (era === "town" || era === "city") {
        const variants = new Set(lay.things.filter((t) => /\/cottage\/\d\/r\d$/.test(t.frame)).map((t) => t.frame.slice(-2)));
        expect(variants.size, `${era} roof variants`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
