/**
 * The island's coastline: an irregular organic land mask around the playable grid, deterministic per
 * radius (a superellipse with low-frequency wobble and value noise, then pruned of single-cell
 * spits and filled in narrow channels). Lots and the ring always sit on land, with a sand beach and
 * open sea between them and the coast. Pure, so the shape is unit-tested; tools/art/proto_island.py
 * prototyped the same recipe.
 */
/** Neighbour order of the shore mask (bit k = land at cells[k]); matches tools/art/terrain.py. */
export const SHORE_CELLS: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

const hcell = (i: number, j: number): number => {
  let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663);
  h = Math.imul(h, 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
const vnoise = (x: number, y: number): number => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (a: number, b: number) => hcell(a + 1000, b + 1000);
  return (v(xi, yi) * (1 - sx) + v(xi + 1, yi) * sx) * (1 - sy) + (v(xi, yi + 1) * (1 - sx) + v(xi + 1, yi + 1) * sx) * sy;
};

export interface Coast {
  r: number;
  /** land cells, back to front */
  cells: { i: number; j: number }[];
  isLand(i: number, j: number): boolean;
  /** 8-bit neighbour mask for the shore overlay (bit k = land at SHORE_CELLS[k]) */
  mask(i: number, j: number): number;
  /** beach cells: outside the ring and touching (or one cell from) the sea */
  sandy(i: number, j: number): boolean;
  /** i/j extent of the land */
  extent: number;
}

const cache = new Map<number, Coast>();

export function coastFor(r: number): Coast {
  const hit = cache.get(r);
  if (hit) return hit;
  const R0 = (r + 1) * 1.32 + 3.3;
  const S = Math.floor(R0 * 1.5) + 2;
  const W = 2 * S + 5;
  const land = new Uint8Array(W * W);
  const at = (i: number, j: number) => (i + S + 2) * W + (j + S + 2);
  const get = (i: number, j: number): boolean => i >= -S - 2 && i <= S + 2 && j >= -S - 2 && j <= S + 2 && land[at(i, j)] === 1;
  const core = (i: number, j: number) => Math.max(Math.abs(i), Math.abs(j)) <= r + 1;
  // lots and ring always keep two cells of beach, however the wobble falls at the corners
  const beach = (i: number, j: number) => Math.max(Math.abs(i), Math.abs(j)) <= r + 2;
  for (let i = -S; i <= S; i++)
    for (let j = -S; j <= S; j++) {
      if (beach(i, j)) {
        land[at(i, j)] = 1;
        continue;
      }
      const th = Math.atan2(j, i);
      const d4 = (Math.abs(i) ** 2.5 + Math.abs(j) ** 2.5) ** 0.4;
      const rt = R0 * (1 + 0.07 * Math.sin(2 * th + 0.7) + 0.05 * Math.sin(3 * th + 2.1) + 0.03 * Math.sin(5 * th + 4.0)) + 3.0 * (vnoise(i / 2.6, j / 2.6) - 0.5);
      if (d4 <= rt) land[at(i, j)] = 1;
    }
  land[at(r + 2, -r + 1)] = 1; // Hesper's tent always has its shore
  const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let pass = 0; pass < 3; pass++) {
    const rem: number[] = [];
    for (let i = -S; i <= S; i++)
      for (let j = -S; j <= S; j++)
        if (get(i, j) && !core(i, j) && !(i === r + 2 && j === -r + 1) && n4.reduce((n, d) => n + (get(i + d[0], j + d[1]) ? 1 : 0), 0) <= 1) rem.push(at(i, j));
    for (const k of rem) land[k] = 0;
    const add: number[] = [];
    for (let i = -S; i <= S; i++)
      for (let j = -S; j <= S; j++) {
        if (get(i, j)) continue;
        const k = n4.reduce((n, d) => n + (get(i + d[0], j + d[1]) ? 1 : 0), 0);
        const chan = (get(i + 1, j) && get(i - 1, j)) || (get(i, j + 1) && get(i, j - 1));
        if (k >= 3 || chan) add.push(at(i, j));
      }
    for (const k of add) land[k] = 1;
  }
  const cells: { i: number; j: number }[] = [];
  let extent = 0;
  for (let i = -S; i <= S; i++)
    for (let j = -S; j <= S; j++)
      if (get(i, j)) {
        cells.push({ i, j });
        extent = Math.max(extent, Math.abs(i), Math.abs(j));
      }
  cells.sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);
  const coast: Coast = {
    r,
    cells,
    extent,
    isLand: get,
    mask(i, j) {
      let m = 0;
      for (let k = 0; k < SHORE_CELLS.length; k++) if (get(i + SHORE_CELLS[k][0], j + SHORE_CELLS[k][1])) m |= 1 << k;
      return m;
    },
    sandy(i, j) {
      if (Math.max(Math.abs(i), Math.abs(j)) < r + 2) return false;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!get(i + a, j + b)) return true;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (!get(i + a, j + b)) return hcell(i, j) < 0.5;
      return false;
    },
  };
  cache.set(r, coast);
  return coast;
}
