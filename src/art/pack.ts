/** Shelf packer for atlas pages (2048² max, ART_BIBLE.md §7). Pure, so tests can check it. */
export interface PackItem {
  name: string;
  w: number;
  h: number;
}
export interface Placed extends PackItem {
  x: number;
  y: number;
  page: number;
}
export interface PackResult {
  placed: Placed[];
  pages: { w: number; h: number }[];
}

/** Gap between frames: 2 px extrude on each side. */
export const PADDING = 4;

const pow2 = (v: number) => {
  let p = 1;
  while (p < v) p *= 2;
  return p;
};

export function packShelves(items: PackItem[], maxSize = 2048, padding = PADDING): PackResult {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || a.name.localeCompare(b.name));
  const placed: Placed[] = [];
  const used: { w: number; h: number }[] = [];
  let page = 0, x = 0, y = 0, shelfH = 0;
  used.push({ w: 0, h: 0 });
  for (const it of sorted) {
    const w = it.w + padding, h = it.h + padding;
    if (w > maxSize || h > maxSize) throw new Error(`frame ${it.name} is larger than the atlas`);
    if (x + w > maxSize) {
      x = 0;
      y += shelfH;
      shelfH = 0;
    }
    if (y + h > maxSize) {
      page++;
      used.push({ w: 0, h: 0 });
      x = 0;
      y = 0;
      shelfH = 0;
    }
    placed.push({ ...it, x: x + padding / 2, y: y + padding / 2, page });
    x += w;
    shelfH = Math.max(shelfH, h);
    used[page].w = Math.max(used[page].w, x);
    used[page].h = Math.max(used[page].h, y + shelfH);
  }
  return { placed, pages: used.map((u) => ({ w: pow2(u.w), h: pow2(u.h) })) };
}
