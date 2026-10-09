import { describe, expect, it } from "vitest";
import { cameraAt, fitZoom } from "../src/sim/camera";
import { BUILDING_TYPES, CITY_COUNTS, eraFrames, footprintForLook, stageOf } from "../src/sim/catalog";
import { buildCity, CITY_SIZE, isGreyLot, lotIndex } from "../src/sim/city";
import { CommandLog } from "../src/sim/commands";
import { cycleAt, lightAt, phaseAt } from "../src/sim/daycycle";
import { project, unproject } from "../src/sim/iso";
import { KIND_FIRE, KIND_SMOKE, MAX_RADIUS, ParticlePool, SMOKE_PER_FRAME } from "../src/sim/particles";
import { buildPeople, figureCount, raiderPose, villagerPose, type FigurePose } from "../src/sim/people";
import { Rng } from "../src/sim/rng";

const pose = (): FigurePose => ({ x: 0, y: 0, visible: false, walking: false, facing: 1, beat: 0 });

describe("seeded rng", () => {
  it("replays the same sequence for the same seed", () => {
    const a = new Rng(42), b = new Rng(42);
    const sa = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(sa);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Rng(43).next()).not.toBe(sa[0]);
  });
});

describe("command log", () => {
  it("is append-only with sequence numbers", () => {
    const log = new CommandLog();
    log.append({ kind: "setMode", mode: "worst" }, 10);
    const e = log.append({ kind: "setTier", tier: "low", reason: "drop" }, 20);
    expect(e.seq).toBe(2);
    expect(() => log.append({ kind: "cinematic" }, 5)).toThrow();
    expect(log.between(15, 30).map((x) => x.seq)).toEqual([2]);
    expect(Object.isFrozen(log.all()[0])).toBe(true);
  });
});

describe("iso projection", () => {
  it("is exact 2:1 and invertible", () => {
    const p = project(3, 1);
    expect(p).toEqual({ x: 128, y: 128 });
    const q = project(1, 0);
    expect(Math.abs(q.x / q.y)).toBe(2);
    expect(unproject(p.x, p.y)).toEqual({ i: 3, j: 1 });
  });
});

describe("catalogue", () => {
  it("has 189 building frames across the four eras and the right footprints", () => {
    const total = (["colony", "village", "town", "city"] as const).reduce((s, e) => s + eraFrames(e).length, 0);
    expect(total).toBe(189);
    expect(eraFrames("city")).toHaveLength(91);
    expect([0, 3, 4, 5, 6].map(footprintForLook)).toEqual([1, 1, 2, 2, 3]);
    expect([0, 2, 3, 12, 18, 20].map(stageOf)).toEqual([0, 0, 1, 4, 6, 6]);
  });
});

describe("city stress island", () => {
  const city = buildCity(1);
  it("is deterministic for a seed", () => {
    expect(buildCity(1)).toEqual(city);
    expect(buildCity(2).buildings.map((b) => [b.i, b.j])).not.toEqual(city.buildings.map((b) => [b.i, b.j]));
  });
  it("places every City building type at its count, mostly at looks 5-7", () => {
    for (const t of BUILDING_TYPES) {
      const n = city.buildings.filter((b) => b.type === t && !b.block).length;
      expect(n, t).toBe(CITY_COUNTS[t]);
    }
    const big = city.buildings.filter((b) => !b.block && b.n >= 2).length;
    expect(big).toBeGreaterThan(30);
    expect(city.buildings.some((b) => b.n === 3)).toBe(true);
    expect(city.buildings.some((b) => b.block)).toBe(true);
  });
  it("never overlaps footprints and fills the 21x21 lots", () => {
    const used = new Map<number, number>();
    for (const b of city.buildings)
      for (let dj = 0; dj < b.n; dj++)
        for (let di = 0; di < b.n; di++) {
          const k = lotIndex(b.i + di, b.j + dj);
          expect(used.has(k)).toBe(false);
          used.set(k, b.id);
        }
    expect(city.lotUse.filter((u) => u === "empty")).toHaveLength(0);
    expect(city.lotUse).toHaveLength(CITY_SIZE * CITY_SIZE);
  });
  it("greys half the lots, sea-facing front first", () => {
    expect(city.greyCount).toBe(221);
    expect(isGreyLot(city, 20, 20)).toBe(true);
    expect(isGreyLot(city, 0, 0)).toBe(false);
    const front = city.greyOrder.slice(0, 5).map((k) => (k % CITY_SIZE) + Math.floor(k / CITY_SIZE));
    expect(front[0]).toBe(40);
  });
  it("has a full 7th-stage ring with gates on the hour-line roads, and 6 fires", () => {
    expect(city.walls).toHaveLength(4 * CITY_SIZE + 4);
    expect(city.walls.every((w) => w.stage === 6)).toBe(true);
    expect(city.walls.filter((w) => w.piece.startsWith("gate"))).toHaveLength(12);
    expect(city.buildings.filter((b) => b.fire)).toHaveLength(6);
    expect(city.boats).toHaveLength(6);
    expect(city.props.length).toBeGreaterThan(300);
  });
});

describe("people", () => {
  const city = buildCity(1);
  const people = buildPeople(city, { villagers: 50, raiders: 24, clusters: 48, perCluster: 33 });
  it("builds the gate load: ~1,600 crowd figures, 50 villagers, 24 raiders", () => {
    expect(people.clusters).toHaveLength(48);
    expect(figureCount(people)).toBe(50 + 24 + 48 * 33);
    expect(people.villagers.every((v) => v.path.length === 4)).toBe(true);
  });
  it("follows the day: walk at dawn and dusk, work by day, only the watch at night", () => {
    const v = people.villagers.find((x) => x.job !== "watch")!;
    const w = people.villagers.find((x) => x.job === "watch")!;
    expect(villagerPose(v, 0.07, phaseAt(0.07), false, pose()).walking).toBe(true);
    expect(villagerPose(v, 0.5, phaseAt(0.5), false, pose())).toMatchObject({ walking: false, visible: true });
    expect(villagerPose(v, 1.5, phaseAt(1.5), false, pose()).visible).toBe(false);
    expect(villagerPose(w, 1.5, phaseAt(1.5), false, pose()).visible).toBe(true);
    expect(villagerPose(v, 0.5, "day", true, pose()).visible).toBe(false);
    const start = villagerPose(v, 0, "dawn", false, pose());
    expect({ x: start.x, y: start.y }).toEqual(v.path[0]);
  });
  it("lands raiders from the boats onto the wall", () => {
    const r = people.raiders[0];
    expect(raiderPose(r, 0, pose()).visible).toBe(false);
    const end = raiderPose(r, 1, pose());
    expect({ x: end.x, y: end.y }).toEqual(r.path[2]);
  });
  it("caps figures per workplace", () => {
    const perWork = new Map<string, number>();
    for (const v of people.villagers) {
      const k = JSON.stringify(v.path[3]);
      perWork.set(k, (perWork.get(k) ?? 0) + 1);
    }
    expect(Math.max(...perWork.values())).toBeLessThanOrEqual(6);
  });
});

describe("particles", () => {
  it("never exceeds the cap, clamps radius and spends at most 3 smoke puffs a frame", () => {
    const pool = new ParticlePool(300);
    for (let k = 0; k < 400; k++) pool.spawn(KIND_FIRE, 0, 0, 0, -10, 1, 99, 99);
    expect(pool.count).toBe(300);
    expect(Math.max(...pool.r.slice(0, pool.count))).toBe(MAX_RADIUS);
    const small = new ParticlePool(50);
    let smoke = 0;
    for (let k = 0; k < 10; k++) if (small.spawn(KIND_SMOKE, 0, 0, 0, 0, 1, 2)) smoke++;
    expect(smoke).toBe(SMOKE_PER_FRAME);
    small.step(0.016);
    expect(small.spawn(KIND_SMOKE, 0, 0, 0, 0, 1, 2)).toBe(true);
    small.step(2);
    expect(small.count).toBe(0);
  });
});

describe("day cycle and camera", () => {
  it("runs dawn, day, dusk, night with darker tints at night", () => {
    expect([0.05, 0.5, 0.9, 1.5].map(phaseAt)).toEqual(["dawn", "day", "dusk", "night"]);
    expect(lightAt(0.5).tintAlpha).toBe(0);
    expect(lightAt(2).tintAlpha).toBeCloseTo(0.52);
    expect(lightAt(1.6).night).toBe(1);
    expect(cycleAt(45, 90)).toBeCloseTo(1);
  });
  it("moves, then settles and holds", () => {
    const shots = [{ x: 0, y: 0, zoom: 1 }, { x: 100, y: 50, zoom: 3 }];
    const mid = cameraAt(1.0, shots, 2, 3, 0.33);
    expect(mid.settled).toBe(false);
    const held = cameraAt(3.0, shots, 2, 3, 0.33);
    expect(held).toEqual({ x: 0, y: 0, zoom: 0.33, settled: true });
    expect(fitZoom(540, 1600)).toBeCloseTo(0.344, 2);
  });
});
