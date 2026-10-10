import { describe, expect, it } from "vitest";
import { TIERS } from "../src/perf/quality";
import { AMBIENT, crestAlpha, gullPose, gullSpecs, rng, seaState, seaStepsPerSecond, WAVE_DIR } from "../src/render/island/ambient";

describe("gulls", () => {
  it("face the way they fly: the mirror flag follows the sign of the velocity", () => {
    for (const speed of [-14, -6, 6, 14]) {
      const g = { speed, y0: 100, bob: 6, phase: 0.3 };
      for (let t = 0; t < 40; t += 0.37) {
        const p = gullPose(g, t, 0, 800);
        expect(p.vx).toBe(speed);
        expect(p.flipX).toBe(speed > 0);
      }
    }
  });
  it("move in the direction of their heading (never backwards), wrapping to the far side", () => {
    for (const speed of [-10, 10]) {
      const g = { speed, y0: 0, bob: 0, phase: 0.1 };
      let wraps = 0, prev = gullPose(g, 0, 0, 800).x;
      for (let t = 0.1; t < 200; t += 0.1) {
        const x = gullPose(g, t, 0, 800).x;
        if (Math.sign(x - prev) === -Math.sign(speed)) wraps++;
        else expect(Math.sign(x - prev)).toBe(Math.sign(speed));
        prev = x;
      }
      expect(wraps).toBeGreaterThan(0);
      expect(wraps).toBeLessThan(5);
    }
  });
  it("every gull in the sky flies the same way", () => {
    const specs = gullSpecs(6, 0, 200);
    expect(new Set(specs.map((s) => Math.sign(s.speed))).size).toBe(1);
  });
  it("writes into the caller's object: no allocation in the frame loop", () => {
    const out = { x: 0, y: 0, vx: 0, vy: 0, flipX: false, frame: 0 };
    expect(gullPose({ speed: -9, y0: 0, bob: 3, phase: 0 }, 1, 0, 400, out)).toBe(out);
  });
});

describe("sea", () => {
  it("is calm unless a raid is on screen", () => {
    expect(seaState(false)).toBe("calm");
    expect(seaState(true)).toBe("rough");
  });
  it("the calm shimmer is slow, rough water is livelier, Low stays still", () => {
    expect(seaStepsPerSecond(AMBIENT.mid, "calm")).toBeLessThanOrEqual(2);
    expect(seaStepsPerSecond(AMBIENT.mid, "rough")).toBeGreaterThan(seaStepsPerSecond(AMBIENT.mid, "calm"));
    expect(seaStepsPerSecond(AMBIENT.low, "calm")).toBe(0);
    expect(seaStepsPerSecond(AMBIENT.low, "rough")).toBe(0);
  });
  it("crests all roll one way, toward the island from the south-east", () => {
    expect(WAVE_DIR.x).toBeLessThan(0);
    expect(WAVE_DIR.y).toBeLessThan(0);
    expect(Math.hypot(WAVE_DIR.x, WAVE_DIR.y)).toBeCloseTo(1, 2);
  });
  it("crest opacity is stepped and fades at both ends", () => {
    const a = [0, 0.1, 0.2, 0.5, 0.75, 0.9].map((u) => crestAlpha(u, true));
    expect(new Set(a).size).toBeLessThanOrEqual(3);
    expect(a[0]).toBeLessThan(a[3]);
    expect(a[5]).toBeLessThan(a[3]);
  });
  it("the seeded generator is deterministic", () => {
    const a = rng(5), b = rng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("quality switches", () => {
  it("Low is static (smoke and flags only): no gulls, crests, sway, mesh, glint or clouds", () => {
    expect(AMBIENT.low).toMatchObject({ seaFps: 0, gulls: 0, sway: false, crests: 0, mesh: false, glint: false, clouds: 0 });
  });
  it("Medium adds sprite sway, foam crests and gulls but no filters or mesh", () => {
    expect(AMBIENT.mid.sway).toBe(true);
    expect(AMBIENT.mid.gulls).toBeGreaterThan(0);
    expect(AMBIENT.mid.crests).toBeGreaterThan(0);
    expect(AMBIENT.mid.mesh || AMBIENT.mid.glint || AMBIENT.mid.clouds > 0).toBe(false);
  });
  it("High adds mesh sway, the water highlight and cloud shadows on top of Medium", () => {
    expect(AMBIENT.high).toMatchObject({ mesh: true, glint: true, sway: true });
    expect(AMBIENT.high.clouds).toBeGreaterThan(0);
    expect(AMBIENT.high.crests).toBeGreaterThanOrEqual(AMBIENT.mid.crests);
  });
  it("every graphics tier has a table", () => {
    for (const t of Object.keys(TIERS)) expect(AMBIENT[t as keyof typeof AMBIENT]).toBeDefined();
  });
});
