/**
 * Dev tool page: draws the procedural frames (people, set pieces) at a high scale and hands the PNGs to
 * tools/art/dump.mjs, so tools/art/build_art.py can pixelize them into the shipped atlas.
 * Not part of the game bundle.
 */
import { frameDefs } from "../../src/art/island/atlas";
import type { Era } from "../../src/art/island/palette";

interface Dumped { w: number; h: number; ax: number; ay: number; png: string }
(window as unknown as { dumpFrames: (era: Era, s: number, re: string) => Record<string, Dumped> }).dumpFrames = (era, s, re) => {
  const rx = new RegExp(re);
  const out: Record<string, Dumped> = {};
  for (const f of frameDefs(era)) {
    if (f.grey || !rx.test(f.name)) continue;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(f.w * s);
    cv.height = Math.ceil(f.h * s);
    f.draw(cv.getContext("2d")!, s);
    out[f.name] = { w: f.w, h: f.h, ax: f.ax, ay: f.ay, png: cv.toDataURL("image/png") };
  }
  return out;
};
(window as unknown as { dumpReady: boolean }).dumpReady = true;
