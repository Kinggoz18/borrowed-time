/**
 * The FINAL_PLAN_BT.md §6 sim gates, one test per gate (docs/SIM_GATES.md). Runs the headless
 * sim: 24 colonies x 45 seasons for each of the five strategy bots, from empty land, in parallel
 * Node processes. About two minutes on 8 cores. `npm run test:gates`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { GATE_IDS, gateTitle, type Report } from "../../src/core/gates";
// @ts-expect-error plain ESM script without types
import { bundle, playAll, report } from "../../scripts/sim.mjs";

const RUNS = 24;
const SEASONS = 45;
let rep: Report;

describe(`section 6 sim gates (${RUNS} colonies x ${SEASONS} seasons per strategy)`, () => {
  beforeAll(async () => {
    const entry = (await bundle()) as string;
    const files = (await playAll(entry, RUNS, SEASONS)) as string[];
    const r = (await report(entry, files, true)) as { text: string };
    rep = JSON.parse(r.text) as Report;
  }, 900_000);

  it("reports exactly the catalogued gates", () => {
    expect(rep.gates.map((g) => g.id)).toEqual(GATE_IDS);
  });
  for (const id of GATE_IDS)
    it(gateTitle(id), () => {
      const g = rep.gates.find((x) => x.id === id)!;
      expect(g.pass, `${g.name}: ${g.detail}`).toBe(true);
    });
});
