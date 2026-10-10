/**
 * The pixel-art atlases (tools/art/build_art.py → public/art): PNG-8 pages on one shared palette,
 * loaded lazily per era set, drawn with nearest-neighbour sampling. One art pixel is 1/s world
 * units (s = 1.5 on Medium/High, 0.75 on Low), so a lattice step in the world is a whole number of
 * art pixels and the camera can snap to whole device pixels (view.ts). Later eras add a set to
 * the manifest ("village", "town", "city"); nothing here is colony-specific.
 */
import { ImageSource, Rectangle, Texture } from "pixi.js";
import { JOBS, personFrameName } from "../island/people";

export type ArtScale = "m" | "l";
export interface PixelManifest {
  version: number;
  scales: Record<ArtScale, { s: number }>;
  /** set name → atlas files (public/art/<scale>/<set>.png + .json) */
  sets: Record<string, string[]>;
  /** era → the sets it needs, in lookup order */
  eras: Record<string, string[]>;
  sea: { tile: number; calm: number; rough: number };
  /** per-frame anchors in atlas px: chimney (smoke), pole (flag) */
  anchors: Record<string, { chimney?: [number, number]; pole?: [number, number] }>;
  shore: { cells: [number, number][]; masks: Record<string, string> };
}
/** [x, y, w, h, ax, ay] in atlas px */
type RawFrame = [number, number, number, number, number, number];
interface PageJson {
  w: number;
  h: number;
  frames: Record<string, RawFrame>;
}

export interface PixelArt {
  readonly s: number;
  /** world units per art pixel */
  readonly u: number;
  readonly manifest: PixelManifest;
  get(name: string): Texture;
  has(name: string): boolean;
  /** frame as a data URL for the DOM, "" if unknown */
  thumb(name: string): string;
  anchor(name: string): { chimney?: [number, number]; pole?: [number, number] } | undefined;
  /** Frame anchor in world units, relative to the frame's own anchor. */
  offset(name: string, p: [number, number]): { x: number; y: number };
  calm: Texture[];
  rough: Texture[];
  glint: Texture;
  /** Lazily add an era's sets (no-op when already loaded). */
  ensureEra(era: string): Promise<void>;
  shoreFrame(mask: number): string | null;
  /** Register an era's `g/<era>/…` ground aliases once its sets are loaded. */
  alias(era: string): void;
  /** names a layout may ask for, for the catalogue test */
  names(): string[];
  destroy(): void;
}

const eraAliases = (era: string, name: string): string[] => {
  const m = /^(grey\/)?g\/([a-z]+)\/(\d+)$/.exec(name);
  return m ? [`${m[1] ?? ""}g/${era}/${m[2]}/${m[3]}`] : [];
};

export interface PixelIO {
  json(url: string): Promise<unknown>;
  bitmap(url: string): Promise<ImageBitmap | HTMLImageElement>;
}
const browserIO: PixelIO = {
  json: async (url) => (await fetch(url)).json(),
  bitmap: async (url) => createImageBitmap(await (await fetch(url)).blob()),
};

export async function loadPixelArt(base: string, key: ArtScale, era: string, io: PixelIO = browserIO): Promise<PixelArt> {
  const manifest = (await io.json(`${base}/manifest.json`)) as PixelManifest;
  const s = manifest.scales[key].s;
  const tex = new Map<string, Texture>();
  const anchors = manifest.anchors;
  const frameWorld = new Map<string, { ax: number; ay: number }>();
  const sources: ImageSource[] = [];
  const bitmaps: { img: ImageBitmap | HTMLImageElement; raw: Map<string, RawFrame> }[] = [];
  const loaded = new Set<string>();
  const thumbs = new Map<string, string>();
  /** alias frame name → the pixel page frame it points at (thumbnails are cut from the page by real name) */
  const aliasOf = new Map<string, string>();
  const mk = (img: ImageBitmap | HTMLImageElement, repeat = false): ImageSource =>
    new ImageSource({ resource: img, resolution: s, scaleMode: "nearest", autoGenerateMipmaps: false, addressMode: repeat ? "repeat" : "clamp-to-edge" });

  async function addSet(set: string): Promise<void> {
    if (loaded.has(set)) return;
    loaded.add(set);
    const [page, img] = await Promise.all([io.json(`${base}/${key}/${set}.json`) as Promise<PageJson>, io.bitmap(`${base}/${key}/${set}.png`)]);
    const src = mk(img);
    sources.push(src);
    const raw = new Map<string, RawFrame>(Object.entries(page.frames));
    bitmaps.push({ img, raw });
    for (const [name, f] of raw) {
      const t = new Texture({ source: src, frame: new Rectangle(f[0] / s, f[1] / s, f[2] / s, f[3] / s), defaultAnchor: { x: f[4] / f[2], y: f[5] / f[3] } });
      tex.set(name, t);
      frameWorld.set(name, { ax: f[4], ay: f[5] });
    }
  }

  const aliasEra = (e: string): void => {
    for (const name of [...tex.keys()]) for (const a of eraAliases(e, name)) if (!tex.has(a)) {
        tex.set(a, tex.get(name)!);
        aliasOf.set(a, name);
      }
    for (const job of JOBS) {
      for (const n of [0, 1]) {
        const t = tex.get(personFrameName(job, "walk", "se", n));
        if (t) tex.set(`p/${job}/${n}`, t);
      }
    }
    if (!tex.has("fx/smoke") && tex.has("fx/smoke/3")) tex.set("fx/smoke", tex.get("fx/smoke/3")!);
  };

  const sea = async (name: string): Promise<Texture> => {
    const src = mk(await io.bitmap(`${base}/${key}/${name}.png`), true);
    sources.push(src);
    return new Texture({ source: src });
  };

  for (const set of manifest.eras[era] ?? ["shared"]) await addSet(set);
  aliasEra(era);
  const calm: Texture[] = [], rough: Texture[] = [];
  for (let k = 0; k < manifest.sea.calm; k++) calm.push(await sea(`sea_${k}`));
  for (let k = 0; k < manifest.sea.rough; k++) rough.push(await sea(`rough_${k}`));
  const glint = await sea("glint");

  const art: PixelArt = {
    s,
    u: 1 / s,
    manifest,
    get(name) {
      const t = tex.get(name);
      if (!t) throw new Error(`missing pixel frame ${name}`);
      return t;
    },
    has: (name) => tex.has(name),
    thumb(name) {
      let url = thumbs.get(name);
      if (url !== undefined) return url;
      url = "";
      const real = aliasOf.get(name) ?? name;
      for (const b of bitmaps) {
        const f = b.raw.get(real);
        if (!f) continue;
        const c = document.createElement("canvas");
        c.width = f[2];
        c.height = f[3];
        c.getContext("2d")!.drawImage(b.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
        url = c.toDataURL();
        break;
      }
      if (url) thumbs.set(name, url);
      return url;
    },
    anchor: (name) => anchors[name],
    offset(name, p) {
      const a = frameWorld.get(name);
      return a ? { x: (p[0] - a.ax) / s, y: (p[1] - a.ay) / s } : { x: 0, y: 0 };
    },
    calm,
    rough,
    glint,
    async ensureEra(e) {
      for (const set of manifest.eras[e] ?? []) await addSet(set);
      aliasEra(e);
    },
    alias: aliasEra,
    shoreFrame(mask) {
      return manifest.shore.masks[String(mask)] ?? null;
    },
    names: () => [...tex.keys()],
    destroy() {
      for (const t of new Set(tex.values())) t.destroy(false);
      for (const t of [...calm, ...rough, glint]) t.destroy(false);
      for (const src of sources) src.destroy();
      for (const b of bitmaps) (b.img as ImageBitmap).close?.();
    },
  };
  return art;
}
