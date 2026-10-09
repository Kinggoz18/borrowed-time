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
      expect(names).toEqual(expect.arrayContaining(["gnomon", "tent", "boat", "fx/fire", "p/raider/1", "ring/3/segA", "gate/0/B/1"]));
    });
    it(`${era}: fits one 2048 page at the high tier (s = 2)`, () => {
      const packed = packShelves(defs.map((d) => ({ name: d.name, w: Math.ceil(d.w * 2), h: Math.ceil(d.h * 2) })), 2048);
      expect(packed.pages.length).toBe(1);
      expect(Math.max(packed.pages[0].w, packed.pages[0].h)).toBeLessThanOrEqual(2048);
    });
  }
  it("Village has four looks per type and the Colony two (ART_BIBLE.md §9)", () => {
    expect(LOOKS_PER_ERA).toEqual({ colony: 2, village: 4 });
    expect(ERA_TYPES.village).toEqual(expect.arrayContaining(["field", "cottage", "workshop", "tower", "bank", "lantern", "trade"]));
  });
});
