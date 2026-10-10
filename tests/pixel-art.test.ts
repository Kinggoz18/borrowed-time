import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { buildingFrame, groundFrame } from "../src/art/island/atlas";
import { ERA_TYPES, LOOKS_PER_ERA } from "../src/art/island/buildings";
import { ANIM_FRAMES, JOBS, PERSON_ANIMS, PERSON_VIEWS, personFrameName } from "../src/art/island/people";
import { GROUND_KINDS, RING_PIECES, RING_STAGES } from "../src/art/island/scenery";
import { coastFor } from "../src/render/island/coast";

const root = "public/art";
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8"));

describe("pixel-art atlases (tools/art/build_art.py)", () => {
  for (const key of ["m", "l"] as const) {
    const names = new Set<string>();
    for (const set of manifest.eras.colony as string[]) {
      const page = JSON.parse(readFileSync(`${root}/${key}/${set}.json`, "utf8"));
      for (const n of Object.keys(page.frames)) names.add(n);
      it(`${key}/${set}: one page within 2048, frames inside it`, () => {
        expect(page.w).toBeLessThanOrEqual(2048);
        expect(page.h).toBeLessThanOrEqual(2048);
        for (const [x, y, w, h] of Object.values(page.frames) as number[][]) expect(x + w <= page.w && y + h <= page.h).toBe(true);
      });
    }
    it(`${key}: draws every colony frame the game asks for`, () => {
      const need: string[] = [];
      for (const t of ERA_TYPES.colony)
        for (let s = 0; s < LOOKS_PER_ERA.colony; s++) need.push(buildingFrame("colony", t, s), buildingFrame("colony", t, s, true));
      for (const kind of GROUND_KINDS) for (let v = 0; v < 3; v++) need.push(`g/${kind}/${v}`);
      for (const k of ["lot", "plot", "road"]) for (let v = 0; v < 3; v++) need.push(`grey/g/${k}/${v}`);
      for (let st = 0; st < RING_STAGES; st++) {
        for (const p of RING_PIECES) need.push(`ring/${st}/${p}`);
        for (const a of ["A", "B"]) for (const sh of [0, 1]) need.push(`gate/${st}/${a}/${sh}`);
      }
      for (const job of JOBS) for (const a of PERSON_ANIMS) for (const v of PERSON_VIEWS) for (let f = 0; f < ANIM_FRAMES[a]; f++) need.push(personFrameName(job, a, v, f));
      need.push("gnomon", "tent", "boat", "boat/beached", "fx/fire", "fx/dust", "fx/spark", "fx/smoke/0", "fx/smoke/4", "fx/flag/3", "fx/gull/3", "fx/crest/3", "fx/cloud/1", "fx/grass/3/2");
      expect(need.filter((n) => !names.has(n))).toEqual([]);
    });
    it(`${key}: every coast cell has its shore overlay`, () => {
      for (const r of [3, 5, 8, 10]) {
        const c = coastFor(r);
        for (const { i, j } of c.cells) {
          const m = c.mask(i, j);
          if (m === 255) continue;
          const f = manifest.shore.masks[String(m)];
          expect(f, `mask ${m}`).toBeTruthy();
          expect(names.has(f)).toBe(true);
        }
      }
    });
    it(`${key}: colony frames carry the anchors the effects need (chimney smoke, flag poles)`, () => {
      for (const t of ["cottage"]) for (let s = 0; s < 2; s++) expect(manifest.anchors[buildingFrame("colony", t, s)].chimney).toHaveLength(2);
      for (let s = 0; s < 2; s++) expect(manifest.anchors[buildingFrame("colony", "tower", s)].pole).toHaveLength(2);
      expect(manifest.anchors.tent.pole).toHaveLength(2);
    });
  }
  it("fields have sway frames (flush ground decals, no raised edge)", () => {
    const page = JSON.parse(readFileSync(`${root}/m/colony.json`, "utf8"));
    for (const s of [0, 1]) for (const k of ["", "/s1", "/s2"]) expect(page.frames[`b/colony/field/${s}${k}`]).toBeDefined();
  });
  it("ground tiles are the 64x32 world tile at the atlas scale, grass sway frames included", () => {
    const l = JSON.parse(readFileSync(`${root}/l/shared.json`, "utf8")).frames;
    const sc = manifest.scales.l.s;
    expect(l["g/grass/0"][2] / sc).toBeCloseTo(64, -0.5);
    expect(groundFrame("colony", "grass", 0)).toBe("g/colony/grass/0");
  });
  it("sea tiles exist per scale, calm and rough, plus the glint", () => {
    for (const key of ["m", "l"]) {
      for (let k = 0; k < manifest.sea.calm; k++) expect(existsSync(`${root}/${key}/sea_${k}.png`)).toBe(true);
      for (let k = 0; k < manifest.sea.rough; k++) expect(existsSync(`${root}/${key}/rough_${k}.png`)).toBe(true);
      expect(existsSync(`${root}/${key}/glint.png`)).toBe(true);
    }
  });
  it("stays small: the Low download under 80 KB, the High one under 320 KB (PNG-8, one shared palette)", () => {
    const sum = (key: string) => ["shared", "colony"].reduce((n, s) => n + statSync(`${root}/${key}/${s}.png`).size, 0);
    expect(sum("l")).toBeLessThan(80_000);
    expect(sum("m")).toBeLessThan(320_000);
  });
});
