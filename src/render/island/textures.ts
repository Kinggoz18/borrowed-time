/** Turns the boot-time island atlas (Canvas 2D pages) into Pixi textures. */
import { CanvasSource, Rectangle, Texture } from "pixi.js";
import type { IslandAtlas } from "../../art/island/atlas";
import { JOBS, personFrameName } from "../../art/island/people";

export interface IslandTextures {
  get(name: string): Texture;
  has(name: string): boolean;
  grain: Texture;
  /** atlas pixel scale (2 = high tier art) */
  s: number;
  sources: CanvasSource[];
  destroy(): void;
}

export function toTextures(atlas: IslandAtlas): IslandTextures {
  const s = atlas.s;
  // resolution = s: one world unit is one pixel of the s = 1 art, whatever tier the atlas was drawn at
  const sources = atlas.pages.map((c) => new CanvasSource({ resource: c, resolution: s, autoGenerateMipmaps: true, scaleMode: "linear" }));
  const cache = new Map<string, Texture>();
  for (const [name, f] of atlas.frames) {
    const t = new Texture({ source: sources[f.page], frame: new Rectangle(f.x / s, f.y / s, f.w / s, f.h / s), defaultAnchor: { x: f.ax, y: f.ay } });
    cache.set(name, t);
  }
  for (const job of JOBS) {
    const a = cache.get(personFrameName(job, "walk", "se", 0));
    const b = cache.get(personFrameName(job, "walk", "se", 1));
    if (a) cache.set(`p/${job}/0`, a);
    if (b) cache.set(`p/${job}/1`, b);
  }
  const grainSrc = new CanvasSource({ resource: atlas.grain, addressMode: "repeat" });
  const grain = new Texture({ source: grainSrc });
  return {
    get(name) {
      const t = cache.get(name);
      if (!t) throw new Error(`missing frame ${name}`);
      return t;
    },
    has: (name) => cache.has(name),
    grain,
    s,
    sources,
    destroy() {
      const unique = new Set(cache.values());
      for (const t of unique) t.destroy(false);
      for (const src of sources) src.destroy();
      grainSrc.destroy();
    },
  };
}
