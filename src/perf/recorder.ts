/**
 * Frame-time capture for the performance gate: one CSV row per second (fps, p50/p95/p99 frame
 * times, draw calls, texture memory, heap) plus whole-run summaries. Pure: no DOM, no timers.
 */
export interface FrameSample {
  /** Interval since the previous frame (what the player sees). */
  frameMs: number;
  /** Time spent in the scene update (JS). */
  updateMs: number;
  drawCalls: number;
  visible: number;
  particles: number;
}

export interface SecondRow {
  second: number;
  fps: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  updateMs: number;
  drawCalls: number;
  visible: number;
  particles: number;
  texMB: number;
  heapMB: number;
  tier: string;
  mode: string;
  phase: string;
  raid: boolean;
  events: string;
}

export interface Context {
  texMB: number;
  heapMB: number;
  tier: string;
  mode: string;
  phase: string;
  raid: boolean;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export class FrameRecorder {
  readonly rows: SecondRow[] = [];
  readonly allFrames: number[] = [];
  private bucket: FrameSample[] = [];
  private bucketStart = -1;
  private events: string[] = [];

  /** Add a frame that ended at nowMs. Closes a row each time a full second has passed. */
  add(sample: FrameSample, nowMs: number, ctx: Context): SecondRow | null {
    if (this.bucketStart < 0) this.bucketStart = nowMs;
    this.bucket.push(sample);
    this.allFrames.push(sample.frameMs);
    if (nowMs - this.bucketStart < 1000) return null;
    const span = nowMs - this.bucketStart;
    const ft = this.bucket.map((b) => b.frameMs);
    const avg = (f: (b: FrameSample) => number) => this.bucket.reduce((s, b) => s + f(b), 0) / this.bucket.length;
    const row: SecondRow = {
      second: this.rows.length + 1,
      fps: round((this.bucket.length * 1000) / span, 1),
      p50: round(percentile(ft, 50)),
      p95: round(percentile(ft, 95)),
      p99: round(percentile(ft, 99)),
      max: round(Math.max(...ft)),
      updateMs: round(avg((b) => b.updateMs)),
      drawCalls: Math.round(avg((b) => b.drawCalls)),
      visible: Math.round(avg((b) => b.visible)),
      particles: Math.round(avg((b) => b.particles)),
      texMB: round(ctx.texMB, 1),
      heapMB: round(ctx.heapMB, 1),
      tier: ctx.tier,
      mode: ctx.mode,
      phase: ctx.phase,
      raid: ctx.raid,
      events: this.events.join(" | "),
    };
    this.rows.push(row);
    this.bucket = [];
    this.events = [];
    this.bucketStart = nowMs;
    return row;
  }

  /** Note something that happened (tier drop, cinematic, rebake), written into the next row. */
  note(event: string): void {
    if (!this.events.includes(event)) this.events.push(event);
  }

  summary(): RunSummary {
    return summarize(this.rows, this.allFrames);
  }
}

export interface RunSummary {
  seconds: number;
  frames: number;
  fpsMedian: number;
  fpsWorstSecond: number;
  p50: number;
  p95: number;
  p99: number;
  drawCallsMax: number;
  texMBMax: number;
  /** Average fps per whole minute (for the 10-minute throttle check). */
  minuteFps: number[];
}

export function summarize(rows: SecondRow[], frames: number[]): RunSummary {
  const fps = rows.map((r) => r.fps);
  const minuteFps: number[] = [];
  for (let m = 0; m + 60 <= rows.length; m += 60) minuteFps.push(round(rows.slice(m, m + 60).reduce((s, r) => s + r.fps, 0) / 60, 1));
  return {
    seconds: rows.length,
    frames: frames.length,
    fpsMedian: round(percentile(fps, 50), 1),
    fpsWorstSecond: fps.length ? Math.min(...fps) : 0,
    p50: round(percentile(frames, 50)),
    p95: round(percentile(frames, 95)),
    p99: round(percentile(frames, 99)),
    drawCallsMax: rows.length ? Math.max(...rows.map((r) => r.drawCalls)) : 0,
    texMBMax: rows.length ? Math.max(...rows.map((r) => r.texMB)) : 0,
    minuteFps,
  };
}

export const CSV_COLUMNS: (keyof SecondRow)[] = ["second", "fps", "p50", "p95", "p99", "max", "updateMs", "drawCalls", "visible", "particles", "texMB", "heapMB", "tier", "mode", "phase", "raid", "events"];

const cell = (v: unknown) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with `# key,value` metadata lines on top (device, startup, summary), then one row per second. */
export function toCsv(rows: SecondRow[], meta: Record<string, string | number>): string {
  const lines = Object.entries(meta).map(([k, v]) => `# ${k},${cell(v)}`);
  lines.push(CSV_COLUMNS.join(","));
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => cell(r[c])).join(","));
  return lines.join("\n") + "\n";
}
