import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import type { IslandState } from "../src/core/state";

const fresh = (): IslandState => E.newGame({ seed: 2 });
const village = (): IslandState => {
  const st = fresh();
  st.tier = 1;
  st.hours = 5000;
  st.L = 8;
  const r = (7 - 1) / 2;
  for (let i = -r; i <= r; i++)
    for (let j = -r; j <= r; j++) if (Math.abs(i) + Math.abs(j) <= r) st.lots[`${i},${j}`] = st.lots[`${i},${j}`] ?? null;
  return st;
};

describe("settlement glob buildings", () => {
  it("palisade and roads can upgrade after the first build", () => {
    const st = village();
    expect(E.build(st, "pal", "palisade")).toBe(true);
    expect(E.canUpgrade(st, "pal")).toBe(true);
    expect(E.upgrade(st, "pal")).toBe(true);
    expect(st.pal!.n).toBe(1);
    expect(E.build(st, "road", "road")).toBe(true);
    expect(E.canUpgrade(st, "road")).toBe(true);
    expect(E.upgrade(st, "road")).toBe(true);
    expect(st.road!.n).toBe(1);
  });
});
