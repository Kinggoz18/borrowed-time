/**
 * Homes, workplaces and road-and-lot-centre paths for island figures.
 * Pure: no Pixi. Walkers never cross the gnomon or a building footprint.
 */
import * as E from "../../core/engine";
import { kij } from "../../core/rules";
import type { IslandState } from "../../core/state";
import type { Job } from "../../art/island/people";
import { cellFront, radius, TH } from "./layout";

export type PersonView = "se" | "sw" | "ne" | "nw";

export interface WalkerPlan {
  job: Job;
  home: string;
  work: string;
}

const JOB_OF: Record<string, Job> = {
  field: "field",
  cottage: "field",
  workshop: "clockworks",
  tower: "watch",
  bank: "trade",
  trade: "trade",
  lantern: "clockworks",
};

export const lotCentre = (key: string): { x: number; y: number } => {
  const [i, j] = kij(key);
  const p = cellFront(i, j);
  return { x: p.x, y: p.y - TH / 2 };
};

export function facingOf(dx: number, dy: number): PersonView {
  if (dx === 0 && dy === 0) return "se";
  if (dy >= 0) return dx >= 0 ? "se" : "sw";
  return dx >= 0 ? "ne" : "nw";
}

export function assignWalkers(st: IslandState, count: number): WalkerPlan[] {
  const homes: string[] = [];
  const work: Record<Job, string[]> = { field: [], clockworks: [], trade: [], watch: [], raider: [], hesper: [], nell: [], ada: [], tobias: [], noon: [] };
  const empty: string[] = [];
  for (const [k, b] of Object.entries(st.lots)) {
    if (!b) {
      empty.push(k);
      continue;
    }
    if (b.type === "cottage") homes.push(k);
    const job = JOB_OF[b.type] ?? "trade";
    work[job].push(k);
  }
  const camp = empty.length ? empty : ["1,0"];
  const pick = (list: string[], i: number, fallback: string[]): string => list[i % list.length] ?? fallback[i % fallback.length] ?? camp[i % camp.length];
  const out: WalkerPlan[] = [];
  const notables: { job: Job; work: Job }[] = [
    { job: "nell", work: "watch" },
    { job: "ada", work: "clockworks" },
    { job: "tobias", work: "field" },
  ];
  for (let i = 0; i < count; i++) {
    if (i < notables.length && count >= 3) {
      const n = notables[i];
      out.push({ job: n.job, home: pick(homes, i, camp), work: pick(work[n.work], i, work.field.length ? work.field : camp) });
      continue;
    }
    const jobs: Job[] = (["field", "clockworks", "watch", "trade"] as Job[]).filter((j) => work[j].length);
    const job = jobs.length ? jobs[(i - Math.min(notables.length, count)) % jobs.length] : "field";
    out.push({ job, home: pick(homes, i, camp), work: pick(work[job], i, camp) });
  }
  return out;
}

export function blockedLots(st: IslandState, allow: Set<string>): Set<string> {
  const blocked = new Set<string>(["0,0"]);
  const { owner } = E.claims(st);
  for (const [k, b] of Object.entries(st.lots)) if (b && !allow.has(k)) blocked.add(k);
  for (const k of Object.keys(owner)) if (!allow.has(k) && !allow.has(owner[k])) blocked.add(k);
  return blocked;
}

export function roadLots(st: IslandState): Set<string> {
  const roads = new Set<string>();
  const r = radius(st.tier);
  for (let i = -r; i <= r; i++)
    for (let j = -r; j <= r; j++) {
      if (!i && !j) continue;
      if (st.road ? i === 0 || j === 0 : false) roads.add(`${i},${j}`);
    }
  return roads;
}

/** Axis-aligned lot-centre path. Prefers roads; never enters blocked cells or the gnomon. */
export function route(from: string, to: string, blocked: Set<string>, roads: Set<string>, r: number): string[] {
  if (from === to) return [from];
  const start = from;
  const goal = to;
  const key = (i: number, j: number) => `${i},${j}`;
  const ok = (i: number, j: number, dest: boolean): boolean => {
    if (!i && !j) return false;
    if (Math.max(Math.abs(i), Math.abs(j)) > r) return false;
    const k = key(i, j);
    if (dest && k === goal) return true;
    return !blocked.has(k);
  };
  const [si, sj] = kij(start);
  const [gi, gj] = kij(goal);
  const h = (i: number, j: number) => Math.abs(i - gi) + Math.abs(j - gj);
  const costAt = (i: number, j: number) => (roads.has(key(i, j)) ? 0.55 : 1);
  const open: { i: number; j: number; g: number; f: number }[] = [{ i: si, j: sj, g: 0, f: h(si, sj) }];
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[start, 0]]);
  const seen = new Set<string>();
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.i, cur.j);
    if (ck === goal) break;
    if (seen.has(ck)) continue;
    seen.add(ck);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = cur.i + di, nj = cur.j + dj;
      if (!ok(ni, nj, true)) continue;
      const nk = key(ni, nj);
      const g = cur.g + costAt(ni, nj);
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, ck);
        open.push({ i: ni, j: nj, g, f: g + h(ni, nj) });
      }
    }
  }
  if (!came.has(goal) && start !== goal) {
    // L-shaped fallback along lot centres, skipping the gnomon
    const mid = si !== 0 || gj !== 0 ? key(si, gj) : key(gi, sj);
    return [start, mid, goal].filter((k, i, a) => a.indexOf(k) === i && k !== "0,0");
  }
  const path = [goal];
  let k = goal;
  while (k !== start && came.has(k)) {
    k = came.get(k)!;
    path.push(k);
  }
  path.reverse();
  if (path[0] !== start) path.unshift(start);
  return path.filter((p) => p !== "0,0" || start === "0,0");
}

export const pathWorld = (lots: string[]): { x: number; y: number }[] => lots.map(lotCentre);
