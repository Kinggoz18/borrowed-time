/**
 * Where the streets run. Pure geometry, no game state, no rules.
 *
 * The lots stay exactly as the rules know them (a square grid of logical cells, keys "i,j"). On
 * the ground each group of three lots is a city block and a street is laid between neighbouring
 * blocks: a logical coordinate c sits at the physical coordinate phys(c) = c + blockOf(c), with
 * blockOf(c) = floor((c + 1) / 3), so the gnomon's block (c = -1..1) is block 0 and the physical
 * streets run on every fourth line, P = 2 (mod 4). Nothing the economy or the sim reads changes: the
 * same lots, caps and costs, only drawn with room between the blocks. Streets are a layout concern.
 */
export const BLOCK = 3;

export const blockOf = (c: number): number => Math.floor((c + 1) / BLOCK);
/** Physical (drawn) coordinate of a logical lot coordinate. */
export const phys = (c: number): number => c + blockOf(c);
/** True when physical coordinate P is a street line (between two blocks). */
export const isStreetLine = (P: number): boolean => (((P % 4) + 4) % 4) === 2;
/** Logical coordinate at physical P, or null on a street line. */
export function logical(P: number): number | null {
  if (isStreetLine(P)) return null;
  const b = Math.floor((P + 2) / 4);
  return P - b;
}
/** Physical half-width of the built area for a lot grid of radius r (the ring stands one further out). */
export const physRadius = (r: number): number => phys(r);

export type StreetKind = "plaza" | "street";
/** The street ground at physical cell (I, J) inside a built area of radius r (null: a lot cell). */
export function streetAt(I: number, J: number, r: number): StreetKind | null {
  if (Math.max(Math.abs(I), Math.abs(J)) > physRadius(r)) return null;
  const a = isStreetLine(I), b = isStreetLine(J);
  if (a && b) return "plaza";
  return a || b ? "street" : null;
}

/** Street and plaza cells inside the built area of radius r. */
export function streetCells(r: number): { i: number; j: number; kind: StreetKind }[] {
  const R = physRadius(r);
  const out: { i: number; j: number; kind: StreetKind }[] = [];
  for (let i = -R; i <= R; i++)
    for (let j = -R; j <= R; j++) {
      const kind = streetAt(i, j, r);
      if (kind) out.push({ i, j, kind });
    }
  return out;
}

/** The gate stands on the street line J = 2: the avenue runs out through it. */
export const GATE_LINE = 2;
export const gateCell = (r: number): { i: number; j: number } => ({ i: physRadius(r) + 1, j: GATE_LINE });

/**
 * Which of the four neighbours a street cell joins: bit 0 = (I+1, J), 1 = (I-1, J), 2 = (I, J+1),
 * 3 (value 8) = (I, J-1). The avenue also runs through the gate cell.
 */
export function streetMask(I: number, J: number, r: number): number {
  const g = gateCell(r);
  const has = (a: number, b: number): boolean => (a === g.i && b === g.j) || streetAt(a, b, r) !== null;
  return (has(I + 1, J) ? 1 : 0) | (has(I - 1, J) ? 2 : 0) | (has(I, J + 1) ? 4 : 0) | (has(I, J - 1) ? 8 : 0);
}

/** Block rectangles in physical cells: [I0, I1, J0, J1] (the outermost ones may be partial). */
export function blocks(r: number): [number, number, number, number][] {
  const R = physRadius(r);
  const spans: [number, number][] = [];
  let start: number | null = null;
  for (let P = -R; P <= R + 1; P++) {
    const open = P <= R && !isStreetLine(P);
    if (open && start === null) start = P;
    if (!open && start !== null) {
      spans.push([start, P - 1]);
      start = null;
    }
  }
  const out: [number, number, number, number][] = [];
  for (const [i0, i1] of spans) for (const [j0, j1] of spans) out.push([i0, i1, j0, j1]);
  return out;
}
