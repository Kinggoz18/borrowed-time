import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync("public/art/manifest.json", "utf8")) as { sets: Record<string, string[]>; eras: Record<string, string[]> };
const page = (scale: "m" | "l", set: string) => JSON.parse(readFileSync(`public/art/${scale}/${set}.json`, "utf8")) as { w: number; h: number; frames: Record<string, number[]> };

describe("era atlases", () => {
  it("the village set draws the Roads icon (flush paved avenue) at both grids", () => {
    expect(manifest.eras.village).toEqual(["shared", "village"]);
    for (const sc of ["m", "l"] as const) expect(Object.keys(page(sc, "village").frames)).toContain("ui/road");
  });
  it("every set listed in the manifest has both grids on disk", () => {
    for (const set of Object.keys(manifest.sets))
      for (const sc of ["m", "l"] as const) expect(statSync(`public/art/${sc}/${set}.png`).size).toBeGreaterThan(0);
  });
});
