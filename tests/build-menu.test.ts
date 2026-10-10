import { describe, expect, it } from "vitest";
import { B, B_TYPES, type BType } from "../src/core/rules";
import { BUILD_GROUPS, BUILD_ORDER, teaserFor, visibleGroups } from "../src/ui/buildMenu";

const names = (tier: number, list: BType[] = BUILD_ORDER) => visibleGroups(tier, list).flatMap((g) => g.types);

describe("build menu", () => {
  it("never lists a building the current era has not unlocked (no Roads in the Colony)", () => {
    const colony = names(0);
    for (const t of ["road", "trade", "lantern", "mirror", "hospital", "exchange", "harbour", "observatory"] as BType[]) expect(colony).not.toContain(t);
    for (const t of colony) expect(B[t].tier ?? 0).toBeLessThanOrEqual(0);
    expect(names(1)).toEqual(expect.arrayContaining(["road", "trade", "lantern"]));
    expect(names(1)).not.toContain("hospital");
    expect(names(3)).toEqual(expect.arrayContaining(["exchange", "harbour", "observatory"]));
  });
  it("puts every building type in exactly one function group", () => {
    const all = BUILD_GROUPS.flatMap((g) => g.types);
    expect([...all].sort()).toEqual([...B_TYPES].sort());
  });
  it("groups by function (Roads in Trade, Hourglass in Civic) and drops empty groups", () => {
    expect(visibleGroups(0, BUILD_ORDER).map((g) => g.title)).toEqual(["Defence", "Dwellings", "Food & farming", "Trade & industry", "Civic"]);
    expect(visibleGroups(0, BUILD_ORDER)[0].types).toEqual(["palisade", "tower"]);
    expect(visibleGroups(1, BUILD_ORDER).find((g) => g.id === "trade")!.types).toEqual(["workshop", "road", "trade"]);
    expect(visibleGroups(0, ["field"]).map((g) => g.id)).toEqual(["food"]);
  });
  it("shows one teaser line per group, never a name, instead of a bottom list", () => {
    expect(teaserFor("trade", 0, BUILD_ORDER)).toBe("New ways to work arrive in the Village.");
    expect(teaserFor("trade", 3, BUILD_ORDER)).toBeNull();
  });
});
