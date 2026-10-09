import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { campaign, STRATEGY_NAMES } from "../src/core/bots";

// sim-test.cjs reads these at load time.
process.env.CORE = path.resolve(__dirname, "reference/prototype-core.js");
process.env.RULES = "build";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ref = require("./reference/sim-test.cjs") as { campaign: (n: string, seed: number, seasons: number) => RefCampaign };
interface RefCampaign {
  seasons: unknown[];
  days: { t: number; tier: number; inc: number; h: number; debt: number; lim: number; L: number; pop: number; day: number; seized: number }[];
  lvlDay: Record<string, number>;
  tierDay: Record<string, number>;
}

describe("parity with the prototype rules (sim-test.js, RULES=build)", () => {
  for (const name of STRATEGY_NAMES)
    for (const seed of [1, 19])
      it(`${name} seed ${seed}: 20 seasons match day by day`, () => {
        const a = ref.campaign(name, seed, 20);
        const b = campaign(name, seed, 20);
        expect(b.days.length).toBe(a.days.length);
        for (let i = 0; i < a.days.length; i++) expect({ i, ...b.days[i] }).toEqual({ i, ...a.days[i] });
        expect(b.seasons).toEqual(a.seasons);
        expect(b.lvlDay).toEqual(Object.fromEntries(Object.entries(a.lvlDay).map(([k, v]) => [k, v])));
        expect(b.tierDay).toEqual(a.tierDay);
      });
});
