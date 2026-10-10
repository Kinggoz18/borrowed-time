import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { needs } from "../src/core/needs";

describe("needs", () => {
  it("fed and housed colony is ok", () => {
    const st = E.newGame({ seed: 2 });
    st.pop = 5;
    const n = needs(st);
    expect(n.food).toBe("ok");
    expect(n.shelter).toBe("ok");
  });
  it("borrowed shore strains safety", () => {
    const st = E.newGame({ seed: 2 });
    E.borrow(st, 10);
    const n = needs(st);
    expect(n.safety).not.toBe("ok");
    expect(E.greyCount(st)).toBeGreaterThan(0);
  });
});
