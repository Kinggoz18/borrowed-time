import { describe, expect, it } from "vitest";
import { trimColonyName } from "../src/core/save";
import { defaultCrest } from "../src/ui/crest";

describe("chronicle meta", () => {
  it("trims and caps colony names", () => {
    expect(trimColonyName("  Margery's Rest  ")).toBe("Margery's Rest");
    expect(trimColonyName("   ")).toBe("New Patience");
    expect(trimColonyName("a".repeat(60)).length).toBe(48);
  });
  it("default crest shape is valid JSON", () => {
    const c = defaultCrest();
    expect(c.shape).toBe("shield");
    expect(c.c1).toMatch(/^#/);
  });
});
