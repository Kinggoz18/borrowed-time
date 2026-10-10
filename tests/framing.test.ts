import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { defaultZoom, FIT_SLACK, oldDefaultZoom, SCALE_OUT } from "../src/render/island/framing";
import { layoutIsland } from "../src/render/island/layout";

const ART_U = 1 / 1.5; // medium/high art grid: world units per art pixel
const screens = [
  { name: "phone 800x360@2", w: 800 - 104, h: 360 - 56, res: 2 },
  { name: "phone 667x375@2", w: 667 - 104, h: 375 - 56, res: 2 },
  { name: "laptop 1440x800@1", w: 1440 - 104, h: 800 - 56, res: 1 },
  { name: "laptop 1920x1080@1", w: 1920 - 104, h: 1080 - 56, res: 1 },
  { name: "retina laptop 1440x900@2", w: 1440 - 104, h: 900 - 56, res: 2 },
];

describe("first view of the island", () => {
  const st = E.newGame({ seed: 1 });
  const lay = layoutIsland(st);
  for (const s of screens) {
    it(`${s.name}: shows the whole ring, scaled out, on a whole device pixel per art pixel`, () => {
      const pb = lay.playBounds;
      const ringFit = Math.min(s.w / pb.w, s.h / pb.h);
      const fb = lay.fitBounds;
      const fitZoom = Math.min(s.w / fb.w, s.h / fb.h);
      const per = s.res * ART_U;
      const z = defaultZoom({ ringFit, fitZoom, per });
      expect(z).toBeLessThanOrEqual(ringFit * FIT_SLACK + 1e-9);
      expect(z).toBeGreaterThanOrEqual(fitZoom - 1e-9);
      expect(z).toBeLessThan(oldDefaultZoom(ringFit) * 0.99);
      const d = z * per;
      if (d >= 1) expect(Math.abs(d - Math.round(d))).toBeLessThan(1e-6);
    });
  }
  it("is no more than the owner's 30-40% scale-out target when the screen has room", () => {
    // wide screens can show the ring at the target; narrow ones go further out to keep it whole
    const ringFit = 2.9;
    const z = defaultZoom({ ringFit, fitZoom: 1.5, per: 0.667 });
    expect(z / oldDefaultZoom(ringFit)).toBeGreaterThanOrEqual(0.6);
    expect(z / oldDefaultZoom(ringFit)).toBeLessThanOrEqual(SCALE_OUT + 0.01);
  });
});
