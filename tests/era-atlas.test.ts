import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERA_TYPES, LOOKS_PER_ERA } from "../src/art/island/buildings";
import { FOOT, TIERS, lotKeys, stageOf } from "../src/core/rules";
import type { Era } from "../src/art/island/palette";
import * as E from "../src/core/engine";
import { eraOf, layoutIsland } from "../src/render/island/layout";

interface Manifest { sets: Record<string, string[]>; eras: Record<string, string[]> }
const manifest = JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as Manifest;
const page = (scale: "m" | "l", set: string) => JSON.parse(readFileSync(`public/art/${scale}/${set}.json`, "utf8")) as { w: number; h: number; frames: Record<string, number[]> };
const framesOf = (scale: "m" | "l", era: string): Set<string> => {
  const out = new Set<string>();
  for (const set of manifest.eras[era]) for (const n of Object.keys(page(scale, set).frames)) out.add(n);
  return out;
};
const ERAS: Era[] = ["village", "town", "city"];

describe("era atlases", () => {
  it("the village set draws the Roads icon (flush paved avenue) at both grids, and every era carries it", () => {
    expect(manifest.eras.village.slice(0, 3)).toEqual(["shared", "village", "blend"]);
    for (const era of ERAS) for (const sc of ["m", "l"] as const) expect(framesOf(sc, era).has("ui/road")).toBe(true);
  });
  it("every set listed in the manifest has both grids on disk", () => {
    for (const set of Object.keys(manifest.sets))
      for (const sc of ["m", "l"] as const) expect(statSync(`public/art/${sc}/${set}.png`).size).toBeGreaterThan(0);
  });
  it("each era has pixel art for every type and every look it reaches, plus the grey-land twin (no procedural stand-in)", () => {
    for (const era of ERAS)
      for (const sc of ["m", "l"] as const) {
        const have = framesOf(sc, era);
        for (const t of ERA_TYPES[era])
          for (let st = 0; st < LOOKS_PER_ERA[era]; st++) {
            expect(have.has(`b/${era}/${t}/${st}`), `${sc} b/${era}/${t}/${st}`).toBe(true);
            expect(have.has(`grey/b/${era}/${t}/${st}`), `${sc} grey/b/${era}/${t}/${st}`).toBe(true);
          }
      }
  });
  it("the big claims (2x2, 3x3) have their own native model for every look that can claim them", () => {
    for (const era of ERAS) {
      const have = framesOf("m", era);
      for (const t of ERA_TYPES[era])
        for (let st = 0; st < LOOKS_PER_ERA[era]; st++) {
          const f = FOOT[t as keyof typeof FOOT]?.[st] ?? 0;
          for (let n = 2; n <= f; n++) expect(have.has(`b/${era}/${t}/${st}/f${n}`), `b/${era}/${t}/${st}/f${n}`).toBe(true);
        }
    }
  });
  it("Town and City carry their own ground (cobbles, flagstone) in the same names the layout asks for", () => {
    for (const era of ["town", "city"] as const) {
      const have = framesOf("m", era);
      for (const kind of ["grass", "lot", "road"]) for (let v = 0; v < 3; v++) expect(have.has(`g/${era}/${kind}/${v}`)).toBe(true);
    }
  });
  it("tiers map to eras and the grid each era can reach never asks past the looks drawn", () => {
    expect([0, 1, 2, 3].map(eraOf)).toEqual(["colony", "village", "town", "city"]);
    TIERS.forEach((t, i) => expect(stageOf(t.cap)).toBeLessThanOrEqual(LOOKS_PER_ERA[eraOf(i)] - 1));
  });
  it("keeps to the atlas budget: one page of at most 2048 wide, 2048 tall, and the PNG bytes of an era stay small", () => {
    const budget: Record<string, [number, number]> = { village: [180_000, 80_000], town: [300_000, 150_000], city: [560_000, 280_000] };
    for (const era of ERAS) {
      for (const sc of ["m", "l"] as const) {
        let bytes = 0;
        for (const set of manifest.eras[era].filter((s) => s !== "shared")) {
          const p = page(sc, set);
          expect(p.w).toBeLessThanOrEqual(2048);
          expect(p.h).toBeLessThanOrEqual(2048);
          bytes += statSync(`public/art/${sc}/${set}.png`).size;
        }
        expect(bytes, `${era} ${sc}`).toBeLessThanOrEqual(budget[era][sc === "m" ? 0 : 1]);
      }
    }
  });
  it("a Town layout draws the big model for a 2x2 claim at native size, and the 1x1 model when the claim is blocked", () => {
    const st = E.newGame({ seed: 1 });
    st.tier = 2;
    st.L = 20;
    for (const k of lotKeys(2)) if (!(k in st.lots)) st.lots[k] = null;
    st.lots["3,3"] = { type: "workshop", n: 12, inv: 1 };
    const have = framesOf("m", "town");
    const pixel = (f: string): boolean => have.has(f);
    const big = layoutIsland(st, { pixel, era: "town" }).things.find((t) => t.key === "3,3")!;
    expect(big.frame).toBe("b/town/workshop/4/f2");
    expect(big.scale).toBe(1);
    st.lots["2,3"] = { type: "field", n: 0, inv: 1 };
    const small = layoutIsland(st, { pixel, era: "town" }).things.find((t) => t.key === "3,3")!;
    expect(small.frame).toMatch(/^b\/town\/workshop\/4(\/r\d)?$/);
  });
});
