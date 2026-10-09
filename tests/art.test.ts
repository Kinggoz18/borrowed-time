import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { atlasSpecs, buildingAtlasFrames } from "../src/art/manifest";
import { packShelves, PADDING } from "../src/art/pack";

const root = resolve(import.meta.dirname, "..");

describe("atlas packer", () => {
  it("packs without overlaps, inside 2048 pages, with padding for extrusion", () => {
    const items = Array.from({ length: 60 }, (_, k) => ({ name: `f${k}`, w: 100 + (k % 5) * 70, h: 120 + (k % 7) * 50 }));
    const { placed, pages } = packShelves(items, 1024);
    expect(placed).toHaveLength(60);
    for (const p of pages) expect(Math.max(p.w, p.h)).toBeLessThanOrEqual(1024);
    for (const a of placed)
      for (const b of placed) {
        if (a === b || a.page !== b.page) continue;
        const apart = a.x + a.w + PADDING / 2 <= b.x || b.x + b.w + PADDING / 2 <= a.x || a.y + a.h + PADDING / 2 <= b.y || b.y + b.h + PADDING / 2 <= a.y;
        expect(apart, `${a.name} vs ${b.name}`).toBe(true);
      }
    expect(() => packShelves([{ name: "huge", w: 3000, h: 10 }])).toThrow();
  });
});

describe("stand-in atlases", () => {
  it("cover every City building look plus terrace blocks at final frame sizes", () => {
    const city = buildingAtlasFrames("city");
    expect(city).toHaveLength(91 + 2);
    expect(city.find((f) => f.name === "city/academy/6")).toMatchObject({ w: 384, h: 448 });
    expect(city.find((f) => f.name === "city/cottage/4")).toMatchObject({ w: 256, h: 320 });
    expect(city.find((f) => f.name === "city/cottage/0")).toMatchObject({ w: 128, h: 192 });
  });

  for (const tier of ["high", "low"] as const) {
    it(`generated ${tier} files match the manifest (run npm run standins after changing art)`, () => {
      const index = JSON.parse(readFileSync(resolve(root, `public/standin/${tier}/index.json`), "utf8"));
      expect(index.standin).toBe(true);
      for (const spec of atlasSpecs()) {
        const names = new Set<string>();
        for (const page of index.atlases[spec.name] as string[]) {
          const sheet = JSON.parse(readFileSync(resolve(root, `public/standin/${tier}/${page}`), "utf8"));
          const max = tier === "low" ? 1024 : 2048;
          expect(sheet.meta.size.w).toBeLessThanOrEqual(max);
          expect(sheet.meta.size.h).toBeLessThanOrEqual(max);
          expect(sheet.meta.scale).toBe(tier === "low" ? 0.5 : 1);
          for (const n of Object.keys(sheet.frames)) names.add(n);
        }
        expect([...names].sort()).toEqual(spec.frames.map((f) => f.name).sort());
      }
    });
  }
});
