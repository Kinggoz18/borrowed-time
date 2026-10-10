import { describe, expect, it } from "vitest";
import { B, B_TYPES, type BType } from "../src/core/rules";
import { BUILD_GROUPS, nextEraLine, visibleGroups } from "../src/ui/buildMenu";

const BUILDABLE: BType[] = ["palisade", "field", "cottage", "workshop", "tower", "bank", "road", "trade", "lantern"];
const names = (tier: number, list: BType[] = BUILDABLE) => visibleGroups(tier, list).flatMap((g) => g.types);

describe("build menu", () => {
  it("never lists a building the current era has not unlocked (no Roads in the Colony)", () => {
    const colony = names(0);
    expect(colony).not.toContain("road");
    expect(colony).not.toContain("trade");
    expect(colony).not.toContain("lantern");
    for (const t of colony) expect(B[t].tier ?? 0).toBeLessThanOrEqual(0);
    expect(names(1)).toEqual(expect.arrayContaining(["road", "trade", "lantern"]));
  });
  it("puts every building type in exactly one function group", () => {
    const all = BUILD_GROUPS.flatMap((g) => g.types);
    expect([...all].sort()).toEqual([...B_TYPES].sort());
  });
  it("groups by function and drops empty groups", () => {
    const g0 = visibleGroups(0, BUILDABLE).map((g) => g.title);
    expect(g0).toEqual(["Defence", "Dwellings", "Food and farming", "Trade and industry"]);
    expect(visibleGroups(1, BUILDABLE).map((g) => g.title)).toContain("Civic and roads");
    expect(visibleGroups(0, BUILDABLE)[0].types).toEqual(["palisade", "tower"]);
  });
  it("shows one slim next-era line instead of locked rows", () => {
    expect(nextEraLine(0, BUILDABLE)).toBe("Village unlocks: Roads, Trade Post, Lantern Hall.");
    expect(nextEraLine(3, BUILDABLE)).toBeNull();
  });
});
