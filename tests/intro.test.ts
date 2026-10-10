import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTRO_CAMERA, INTRO_LINES } from "../src/ui/intro";

describe("intro dialogue", () => {
  it("is a short scene of 5 to 7 plain lines", () => {
    expect(INTRO_LINES.length).toBeGreaterThanOrEqual(5);
    expect(INTRO_LINES.length).toBeLessThanOrEqual(7);
    for (const l of INTRO_LINES) expect(l.text.length).toBeLessThanOrEqual(150);
  });
  it("starts with Nell waking Noon after the wreck and never has one speaker twice in a row", () => {
    expect(INTRO_LINES[0].speaker).toBe("Nell");
    expect(INTRO_LINES[0].text).toMatch(/Noon/);
    expect(INTRO_LINES[0].text).toMatch(/reef/);
    for (let i = 1; i < INTRO_LINES.length; i++) expect(INTRO_LINES[i].speaker).not.toBe(INTRO_LINES[i - 1].speaker);
  });
  it("covers the debt, the dusk raiders and ends on the first goal", () => {
    const all = INTRO_LINES.map((l) => l.text).join(" ");
    expect(all).toMatch(/dusk/i);
    expect(all).toMatch(/lends?/i);
    expect(all).toMatch(/the Late/);
    expect(INTRO_LINES[INTRO_LINES.length - 1].text).toMatch(/Palisade first/);
  });
  it("addresses each non-Noon line to the player by name or follows a question", () => {
    for (const l of INTRO_LINES.slice(1)) if (l.speaker !== "Noon") expect(l.text).toMatch(/Noon|dusk/);
  });
  it("uses the shipped portraits and keeps Noon on the left", () => {
    for (const l of INTRO_LINES) {
      expect(existsSync(`public${l.portrait}`)).toBe(true);
      if (l.speaker === "Noon") expect(l.side).toBe("left");
    }
  });
  it("points the camera at lines that exist", () => {
    expect(INTRO_LINES[INTRO_CAMERA.tent].speaker).toBe("Hesper");
    expect(INTRO_CAMERA.fit).toBe(INTRO_LINES.length - 1);
  });
});
