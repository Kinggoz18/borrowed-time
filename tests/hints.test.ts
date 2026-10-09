import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { bandOf, duskHint } from "../src/core/hints";
import { hashState } from "../src/core/snapshot";

describe("dusk hints", () => {
  it("bands: light < 70% of defence, even 70-110%, heavy above", () => {
    expect(bandOf(69, 100)).toBe("light");
    expect(bandOf(70, 100)).toBe("even");
    expect(bandOf(110, 100)).toBe("even");
    expect(bandOf(111, 100)).toBe("heavy");
  });
  it("quiet nights are announced, raid nights hint without a number", () => {
    const st = E.newGame({ seed: 3 });
    st.day = 1;
    expect(duskHint(st).kind).toBe("quiet");
    st.day = 2;
    const h = duskHint(st);
    expect(["skiffs", "longboats"]).toContain(h.kind);
    expect(h.band).not.toBeNull();
    expect(h.line).not.toMatch(/\d/);
    expect(h.range).toBeNull();
    st.day = 6;
    expect(duskHint(st).kind).toBe("longDusk");
  });
  it("reading a hint never changes the island (no RNG draw)", () => {
    const st = E.newGame({ seed: 5 });
    st.day = 4;
    const before = hashState(st);
    duskHint(st);
    expect(hashState(st)).toBe(before);
  });
});
