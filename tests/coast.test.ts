import { describe, expect, it } from "vitest";
import { coastFor, SHORE_CELLS } from "../src/render/island/coast";
import { cellFront, radius } from "../src/render/island/layout";

describe("island coastline", () => {
  for (const r of [3, 4, 5, 7, 10]) {
    const c = coastFor(r);
    it(`r=${r}: lots and ring on land, tent shore on land, sea on every side`, () => {
      for (let i = -(r + 1); i <= r + 1; i++) for (let j = -(r + 1); j <= r + 1; j++) expect(c.isLand(i, j)).toBe(true);
      expect(c.isLand(r + 2, -r + 1)).toBe(true);
      // every row, column and both diagonals leave the land into open water
      for (let k = -c.extent - 2; k <= c.extent + 2; k++) {
        const edge = c.extent + 2;
        expect(c.isLand(k, edge) || c.isLand(k, -edge) || c.isLand(edge, k) || c.isLand(-edge, k)).toBe(false);
      }
    });
    it(`r=${r}: buildings sit well inside (a beach of 2+ cells, 3 at the first tiers)`, () => {
      for (let i = -r; i <= r; i++)
        for (let j = -r; j <= r; j++)
          for (let d = 1; d <= (r <= 5 ? 3 : 2); d++) for (const [a, b] of [[d, 0], [-d, 0], [0, d], [0, -d]]) expect(c.isLand(i + a, j + b) || Math.max(Math.abs(i + a), Math.abs(j + b)) > r + 3).toBe(true);
    });
    it(`r=${r}: irregular (not a rectangle or a diamond) and free of one-cell spits`, () => {
      const rad = c.cells.map(({ i, j }) => Math.hypot(i, j));
      const edge: number[] = [];
      for (const { i, j } of c.cells) if (c.mask(i, j) !== 255) edge.push(Math.hypot(i, j));
      expect(Math.max(...edge) / Math.min(...edge)).toBeGreaterThan(1.12);
      expect(Math.max(...rad)).toBeGreaterThan(r + 2.5);
      for (const { i, j } of c.cells) {
        if (Math.max(Math.abs(i), Math.abs(j)) <= r + 1 || (i === r + 2 && j === -r + 1)) continue;
        const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => c.isLand(i + a, j + b)).length;
        expect(n4).toBeGreaterThan(1);
      }
    });
  }
  it("is deterministic and the tier radius feeds it", () => {
    expect(coastFor(3)).toBe(coastFor(3));
    expect(radius(0)).toBe(3);
    const front = cellFront(0, 0);
    expect(front.y).toBe(32);
  });
  it("mask bit k means land at SHORE_CELLS[k]", () => {
    const c = coastFor(3);
    expect(c.mask(0, 0)).toBe(255);
    const edge = c.cells.find(({ i, j }) => c.mask(i, j) !== 255)!;
    const m = c.mask(edge.i, edge.j);
    SHORE_CELLS.forEach(([a, b], k) => expect(!!(m & (1 << k))).toBe(c.isLand(edge.i + a, edge.j + b)));
  });
});
