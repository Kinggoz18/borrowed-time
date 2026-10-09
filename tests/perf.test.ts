import { describe, expect, it } from "vitest";
import { evaluateGate } from "../src/perf/gate";
import { textureBytes } from "../src/perf/gpu";
import { FrameRecorder, percentile, summarize, toCsv, CSV_COLUMNS, type Context } from "../src/perf/recorder";

const ctx: Context = { texMB: 70, heapMB: 40, tier: "high", mode: "loop", phase: "day", raid: false };

function feed(rec: FrameRecorder, seconds: number, fps: number, start = 0): number {
  let t = start;
  const ms = 1000 / fps;
  for (let k = 0; k < seconds * fps; k++) {
    t += ms;
    rec.add({ frameMs: ms, updateMs: 1, drawCalls: 20, visible: 900, particles: 300 }, t, ctx);
  }
  return t;
}

describe("frame recorder", () => {
  it("computes percentiles the nearest-rank way", () => {
    const v = Array.from({ length: 100 }, (_, k) => k + 1);
    expect([50, 95, 99, 100].map((p) => percentile(v, p))).toEqual([50, 95, 99, 100]);
    expect(percentile([], 50)).toBe(0);
  });
  it("writes one row per second with fps and frame-time percentiles", () => {
    const rec = new FrameRecorder();
    feed(rec, 5, 60);
    expect(rec.rows.length).toBeGreaterThanOrEqual(4);
    const r = rec.rows[1];
    expect(r.fps).toBeGreaterThan(58);
    expect(r.p95).toBeCloseTo(16.67, 1);
    expect(r.drawCalls).toBe(20);
  });
  it("carries events into the next row and exports CSV with metadata", () => {
    const rec = new FrameRecorder();
    rec.note("tier low (drop)");
    feed(rec, 2, 30);
    expect(rec.rows[0].events).toBe("tier low (drop)");
    const csv = toCsv(rec.rows, { startupMs: 1200, gpu: "Mali-G52, r1" });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("# startupMs,1200");
    expect(lines[1]).toBe('# gpu,"Mali-G52, r1"');
    expect(lines[2]).toBe(CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(3 + rec.rows.length);
  });
  it("averages fps per minute for the throttle check", () => {
    const rec = new FrameRecorder();
    const t = feed(rec, 61, 60);
    feed(rec, 61, 50, t);
    const s = summarize(rec.rows, rec.allFrames);
    expect(s.minuteFps.length).toBe(2);
    expect(s.minuteFps[0]).toBeGreaterThan(s.minuteFps[1]);
    expect(s.fpsWorstSecond).toBeLessThan(51);
  });
});

describe("gate checks (plan §5 table)", () => {
  const base = { startupMs: 2100, texMB: 90, budgetMB: 128, throttleMinutes: 10 };
  it("passes the loop at 60 fps and leaves unexercised checks not measured", () => {
    const rec = new FrameRecorder();
    feed(rec, 20, 60);
    const checks = evaluateGate({ ...base, mode: "loop", summary: rec.summary() });
    const by = Object.fromEntries(checks.map((c) => [c.id, c.verdict]));
    expect(by).toEqual({ typical: "pass", worst: "not measured", startup: "pass", thermals: "not measured", texture: "pass" });
  });
  it("fails worst load below 30 fps, slow startup and textures over budget", () => {
    const rec = new FrameRecorder();
    feed(rec, 20, 25);
    const by = Object.fromEntries(evaluateGate({ ...base, mode: "worst", startupMs: 3400, texMB: 140, summary: rec.summary() }).map((c) => [c.id, c.verdict]));
    expect(by.worst).toBe("fail");
    expect(by.startup).toBe("fail");
    expect(by.texture).toBe("fail");
  });
  it("judges thermals by minute 1 vs the last minute of the 10-minute run", () => {
    const rec = new FrameRecorder();
    let t = 0;
    for (let m = 0; m < 10; m++) t = feed(rec, 60, m < 9 ? 60 : 52, t);
    const s = rec.summary();
    expect(s.minuteFps).toHaveLength(9); // the bucket boundary drops the last partial second
    const c = evaluateGate({ ...base, mode: "throttle", throttleMinutes: 9, summary: s }).find((x) => x.id === "thermals")!;
    expect(c.verdict).toBe("pass");
    const rec2 = new FrameRecorder();
    t = 0;
    for (let m = 0; m < 4; m++) t = feed(rec2, 61, m < 3 ? 60 : 45, t);
    const c2 = evaluateGate({ ...base, mode: "throttle", throttleMinutes: 4, summary: rec2.summary() }).find((x) => x.id === "thermals")!;
    expect(c2.verdict).toBe("fail");
  });
});

describe("texture memory maths", () => {
  it("counts RGBA bytes with a third extra for mipmaps", () => {
    expect(textureBytes(2048, 2048, false) / 2 ** 20).toBe(16);
    expect(textureBytes(2048, 2048, true) / 2 ** 20).toBeCloseTo(21.33, 2);
  });
});
