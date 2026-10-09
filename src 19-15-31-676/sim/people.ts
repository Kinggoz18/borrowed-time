/**
 * People in the stress scene: villagers with a home and a workplace, raiders from the boats,
 * and the gate's 48 crowd clusters (~1,600 figures). Pure: positions are a function of time.
 */
import type { City } from "./city";
import { GNOMON_LOT, ROAD_LINES, inside, lotIndex } from "./city";
import type { DayPhase } from "./daycycle";
import { project, type Point } from "./iso";
import { Rng } from "./rng";

export type Job = "field" | "clockworks" | "trade" | "watch";
export interface Villager {
  id: number;
  job: Job;
  path: Point[]; // home -> road -> work
  lengths: number[]; // cumulative
  phase: number;
}
export interface Raider {
  id: number;
  path: Point[];
  lengths: number[];
  phase: number;
}
export interface CrowdFigure {
  base: Point;
  phase: number;
  kind: number; // costume 0..3
}
export interface Cluster {
  i: number;
  j: number;
  figures: CrowdFigure[];
}

export interface FigurePose {
  x: number;
  y: number;
  visible: boolean;
  walking: boolean;
  facing: 1 | -1;
  /** 0..1 within the walk or work cycle; drives the pin animation. */
  beat: number;
}

export interface People {
  villagers: Villager[];
  raiders: Raider[];
  clusters: Cluster[];
}


function cumulative(path: Point[]): number[] {
  const out = [0];
  for (let k = 1; k < path.length; k++) out.push(out[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y));
  return out;
}

export function along(path: Point[], lengths: number[], u: number): { p: Point; facing: 1 | -1 } {
  const total = lengths[lengths.length - 1];
  const d = Math.max(0, Math.min(1, u)) * total;
  let k = 1;
  while (k < lengths.length - 1 && lengths[k] < d) k++;
  const a = path[k - 1], b = path[k];
  const seg = lengths[k] - lengths[k - 1] || 1;
  const f = Math.max(0, Math.min(1, (d - lengths[k - 1]) / seg));
  return { p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, facing: b.x >= a.x ? 1 : -1 };
}

const nearestRoad = (v: number) => ROAD_LINES.reduce((best, r) => (Math.abs(r - v) < Math.abs(best - v) ? r : best), ROAD_LINES[0]);

export function buildPeople(city: City, counts: { villagers: number; raiders: number; clusters: number; perCluster: number }, seed = 7): People {
  const rng = new Rng(seed);
  const homes = city.buildings.filter((b) => b.type === "cottage");
  const work: Record<Job, typeof city.buildings> = {
    field: city.buildings.filter((b) => b.type === "field"),
    clockworks: city.buildings.filter((b) => b.type === "clockworks"),
    trade: city.buildings.filter((b) => b.type === "tradePost" || b.type === "exchange" || b.type === "harbour"),
    watch: city.buildings.filter((b) => b.type === "watchtower"),
  };
  const jobs: Job[] = ["field", "clockworks", "trade", "watch"];
  const villagers: Villager[] = [];
  const perWork = new Map<number, number>();
  for (let k = 0; k < counts.villagers; k++) {
    const home = homes[k % homes.length];
    let job = jobs[k % jobs.length];
    if (work[job].length === 0) job = "field";
    // At most 3 figures per building (6 for 2x2+), so no spot crowds (plan §2).
    const options = work[job].filter((b) => (perWork.get(b.id) ?? 0) < (b.n >= 2 ? 6 : 3));
    const w = options.length ? rng.pick(options) : rng.pick(work[job]);
    perWork.set(w.id, (perWork.get(w.id) ?? 0) + 1);
    const hi = home.i + home.n / 2, hj = home.j + home.n / 2;
    const wi = w.i + w.n / 2, wj = w.j + w.n / 2;
    const rj = nearestRoad(hj) + 0.5;
    const path = [project(hi, hj), project(hi, rj), project(wi, rj), project(wi, wj)];
    villagers.push({ id: k, job, path, lengths: cumulative(path), phase: rng.range(0, 1) });
  }

  const raiders: Raider[] = [];
  const size = city.size;
  for (let k = 0; k < counts.raiders; k++) {
    const boat = city.boats[k % city.boats.length];
    const gate = ROAD_LINES[k % ROAD_LINES.length] + 0.5;
    const alongI = k % 2 === 0;
    const shore = alongI ? project(gate, size + 4) : project(size + 4, gate);
    const wall = alongI ? project(gate + rng.range(-1.5, 1.5), size + 1.3) : project(size + 1.3, gate + rng.range(-1.5, 1.5));
    const path = [boat.home, shore, wall];
    raiders.push({ id: k, path, lengths: cumulative(path), phase: rng.range(0, 1) });
  }

  // Crowd clusters on roads and the plaza: the plan's gate load, not the shipped design (which caps figures).
  const spots = city.roads.filter((r) => inside(r.i, r.j) && !(r.i === GNOMON_LOT.i && r.j === GNOMON_LOT.j));
  rng.shuffle(spots);
  const clusters: Cluster[] = [];
  for (let c = 0; c < counts.clusters && c < spots.length; c++) {
    const { i, j } = spots[c];
    const figures: CrowdFigure[] = [];
    for (let f = 0; f < counts.perCluster; f++) {
      const p = project(i + rng.range(0.1, 0.9), j + rng.range(0.1, 0.9));
      figures.push({ base: p, phase: rng.range(0, Math.PI * 2), kind: rng.int(0, 3) });
    }
    figures.sort((a, b) => a.base.y - b.base.y);
    clusters.push({ i, j, figures });
  }
  return { villagers, raiders, clusters };
}

/** Where a villager is at day time t (see daycycle.phaseAt) during a raid or not. */
export function villagerPose(v: Villager, t: number, phase: DayPhase, raid: boolean, out: FigurePose): FigurePose {
  const end = v.path[v.path.length - 1];
  out.walking = false;
  out.visible = true;
  out.facing = 1;
  if (raid) {
    // Defenders on the walls; everyone else indoors.
    out.visible = v.job === "watch";
    out.x = end.x;
    out.y = end.y;
    out.beat = (t * 40 + v.phase) % 1;
    return out;
  }
  if (phase === "dawn" || phase === "dusk") {
    const u = phase === "dawn" ? t / 0.15 : 1 - (t - 0.85) / 0.15;
    const { p, facing } = along(v.path, v.lengths, u);
    out.x = p.x;
    out.y = p.y;
    out.walking = true;
    out.facing = phase === "dawn" ? facing : (-facing as 1 | -1);
    out.beat = (t * 60 + v.phase) % 1;
    return out;
  }
  if (phase === "night") {
    // Only the watch is out at night.
    out.visible = v.job === "watch";
    out.x = end.x;
    out.y = end.y;
    out.beat = (t * 20 + v.phase) % 1;
    return out;
  }
  out.x = end.x;
  out.y = end.y;
  out.beat = (t * 30 + v.phase) % 1;
  return out;
}

/** Raider position for raid progress r in [0, 1] (0 = in the boat, 0.6 = ashore, 1 = at the wall). */
export function raiderPose(rd: Raider, r: number, out: FigurePose): FigurePose {
  const u = Math.max(0, Math.min(1, r + (rd.phase - 0.5) * 0.15));
  const { p, facing } = along(rd.path, rd.lengths, u);
  out.x = p.x;
  out.y = p.y;
  out.visible = r > 0;
  out.walking = u < 1;
  out.facing = facing;
  out.beat = (r * 50 + rd.phase) % 1;
  return out;
}

export function figureCount(p: People): number {
  return p.villagers.length + p.raiders.length + p.clusters.reduce((s, c) => s + c.figures.length, 0);
}

export function lotOf(city: City, x: number, y: number): number {
  const i = Math.floor((y / 32 + x / 64) / 2), j = Math.floor((y / 32 - x / 64) / 2);
  return inside(i, j, city.size) ? lotIndex(i, j, city.size) : -1;
}
