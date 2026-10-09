import { describe, expect, it } from "vitest";
import { frameDefs } from "../src/art/island/atlas";
import { ANIM_FRAMES, HESPER_H, JOBS, NOTABLE_JOBS, PERSON_H, personFrame, personFrameName, VILLAGER_JOBS } from "../src/art/island/people";

describe("people models", () => {
  it("keeps the shipped on-screen figure height", () => {
    expect(PERSON_H).toBe(26);
    expect(HESPER_H).toBe(35);
    expect(personFrame("field")).toMatchObject({ w: 28, h: 34, ax: 14, ay: 32 });
    expect(personFrame("hesper")).toMatchObject({ w: 26, h: 42, ax: 13, ay: 40 });
  });
  it("gives each job and notable its own costume and atlas frames", () => {
    expect(VILLAGER_JOBS).toEqual(["field", "clockworks", "trade", "watch"]);
    expect(NOTABLE_JOBS).toEqual(["hesper", "nell", "ada", "tobias", "noon"]);
    const names = frameDefs("colony").map((d) => d.name);
    for (const job of JOBS) {
      expect(names).toContain(`p/${job}/0`);
      expect(names).toContain(`p/${job}/1`);
      expect(personFrame(job).ay).toBeGreaterThan(personFrame(job).h / 2);
    }
  });
  it("exposes walk/idle/work × view frame names for animation", () => {
    expect(ANIM_FRAMES).toEqual({ idle: 2, walk: 4, work: 2 });
    expect(personFrameName("nell", "idle", "nw", 1)).toBe("p/nell/idle/nw/1");
  });
});
