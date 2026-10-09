import { describe, expect, it } from "vitest";
import { apply } from "../src/core/game";
import { cloneState } from "../src/core/snapshot";
import * as E from "../src/core/engine";
import type { IslandState } from "../src/core/state";

const toDusk = (st: IslandState): void => {
  while (st.phase === "day") E.tickHour(st);
};

describe("raid presentation order", () => {
  it("resolveDusk mutates state only after the command (UI holds a pre-command clone for animation)", () => {
    const st = E.newGame({ seed: 99 });
    st.hours = 500;
    E.build(st, "pal", "palisade");
    const lot = E.greyOrder(st).find((k) => E.isFree(st, k))!;
    E.build(st, lot, "tower");
    toDusk(st);
    const before = cloneState(st);
    const evs = apply(st, { t: "dusk", decision: "hold" });
    const raid = evs.find((e) => e.kind === "raid");
    expect(raid).toBeTruthy();
    if (raid?.kind === "raid" && !raid.result.quiet && !raid.result.won) {
      expect(st.lots[lot]!.n).toBeLessThanOrEqual(before.lots[lot]!.n);
      expect(before.lots[lot]!.n).toBeGreaterThan(st.lots[lot]!.n);
    }
  });
});
