import { describe, expect, it } from "vitest";
import { buildingFrame, frameDefs, groundFrame } from "../src/art/island/atlas";
import { ERA_TYPES, LOOKS_PER_ERA } from "../src/art/island/buildings";
import { packShelves } from "../src/art/pack";

describe("island atlas catalogue", () => {
  for (const era of ["colony", "village"] as const) {
    const defs = frameDefs(era);
    it(`${era}: unique frame names, every type x look, normal and grey`, () => {
      const names = defs.map((d) => d.name);
      expect(new Set(names).size).toBe(names.length);
      for (const t of ERA_TYPES[era])
        for (let s = 0; s < LOOKS_PER_ERA[era]; s++) {
          expect(names).toContain(buildingFrame(era, t, s));
          expect(names).toContain(buildingFrame(era, t, s, true));
        }
      expect(names).toContain(groundFrame(era, "lot", 0, true));
      expect(names).toContain(groundFrame(era, "plot", 0));
      expect(names).toContain(groundFrame(era, "plot", 0, true));
      expect(names).toEqual(expect.arrayContaining(["gnomon", "tent", "boat", "fx/fire", "p/raider/walk/se/1", "p/nell/idle/nw/0", "fx/flag/0", "ring/3/segA", "gate/0/B/1"]));
    });
    it(`${era}: high-tier frames pack into 2048 pages (Village may use two for walk cycles)`, () => {
      const packed = packShelves(defs.map((d) => ({ name: d.name, w: Math.ceil(d.w * 2), h: Math.ceil(d.h * 2) })), 2048);
      expect(packed.pages.length).toBeLessThanOrEqual(era === "village" ? 2 : 1);
      for (const p of packed.pages) expect(Math.max(p.w, p.h)).toBeLessThanOrEqual(2048);
    });
  }
  it("every era draws the looks its level cap reaches: Colony 2, Village 4, Town 6, City 7 (ART_BIBLE.md §8, §9)", () => {
    expect(LOOKS_PER_ERA).toEqual({ colony: 2, village: 4, town: 6, city: 7 });
    expect(ERA_TYPES.village).toEqual(expect.arrayContaining(["field", "cottage", "workshop", "tower", "bank", "lantern", "trade"]));
  });
});
