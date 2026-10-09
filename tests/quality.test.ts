import { describe, expect, it } from "vitest";
import { AutoDrop, detectTier, lowerTier, TIERS } from "../src/perf/quality";

const phone = (gpu: string, memoryGB = 6, cores = 8) => ({ gpu, memoryGB, cores, mobile: true });

describe("quality tier presets", () => {
  it("follow the plan's caps and budgets", () => {
    expect([TIERS.high.villagers, TIERS.mid.villagers, TIERS.low.villagers]).toEqual([50, 32, 20]);
    expect([TIERS.high.raiders, TIERS.mid.raiders, TIERS.low.raiders]).toEqual([24, 16, 12]);
    expect([TIERS.high.particles, TIERS.low.particles]).toEqual([300, 150]);
    expect([TIERS.high.budgetMB, TIERS.low.budgetMB]).toEqual([128, 80]);
    expect(TIERS.low.bloom || TIERS.low.atlas !== "low").toBe(false);
    expect(Object.values(TIERS).every((t) => t.dprCap <= 2 && t.boats === 6)).toBe(true);
  });
});

describe("auto-detection", () => {
  it("puts the plan's target phones (Mali-G52/G57, Adreno 610/618) on low", () => {
    expect(detectTier(phone("Mali-G52 MC2")).tier).toBe("low");
    expect(detectTier(phone("Mali-G57 MC2")).tier).toBe("low");
    expect(detectTier(phone("Adreno (TM) 610")).tier).toBe("low");
    expect(detectTier(phone("Adreno (TM) 618")).tier).toBe("low");
  });
  it("puts mid-range GPUs on mid and flagships on high", () => {
    expect(detectTier(phone("Mali-G68 MC4")).tier).toBe("mid");
    expect(detectTier(phone("Adreno (TM) 642L")).tier).toBe("mid");
    expect(detectTier(phone("Adreno (TM) 740")).tier).toBe("high");
    expect(detectTier(phone("Mali-G715-Immortalis MC11")).tier).toBe("high");
    expect(detectTier({ gpu: "ANGLE (NVIDIA GeForce RTX 3060)", memoryGB: 8, cores: 12, mobile: false }).tier).toBe("high");
  });
  it("caps by RAM and cores", () => {
    expect(detectTier(phone("Adreno (TM) 740", 3)).tier).toBe("low");
    expect(detectTier(phone("Adreno (TM) 740", 4)).tier).toBe("mid");
    expect(detectTier(phone("Mali-G68 MC4", 6, 4)).tier).toBe("low");
    expect(detectTier(phone("Google SwiftShader")).tier).toBe("low");
  });
});

describe("auto-drop", () => {
  it("drops after 3 slow seconds in a row, after a 5 s warm-up, one tier at a time", () => {
    const d = new AutoDrop();
    const out = [40, 40, 40, 40, 40, 40, 40, 16, 40, 40, 40].map((p) => d.push(p));
    expect(out.indexOf(true)).toBe(10);
    expect(lowerTier("high")).toBe("mid");
    expect(lowerTier("mid")).toBe("low");
    expect(lowerTier("low")).toBeNull();
  });
});
