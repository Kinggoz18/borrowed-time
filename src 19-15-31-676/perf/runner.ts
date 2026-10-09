/** Ties the recorder, the GPU counters and the gate checks to the running scene. */
import type { Application } from "pixi.js";
import type { CommandLog } from "../sim/commands";
import { describeCommand } from "../sim/commands";
import type { FrameInfo } from "../render/scene";
import type { Scenario, TierConfig } from "../render/config";
import { evaluateGate, type Check } from "./gate";
import { DrawCallCounter, heapMB, textureMemoryMB } from "./gpu";
import { FrameRecorder, toCsv, type SecondRow } from "./recorder";

export class PerfRun {
  readonly recorder = new FrameRecorder();
  readonly counter?: DrawCallCounter;
  startupMs = 0;
  tierReason = "";
  texMB = 0;
  lastRow: SecondRow | null = null;
  lastDrawCalls = 0;
  finished = false;
  private readonly startedAt = performance.now();
  private loggedUpTo = 0;
  private texCheckedAt = -1;

  constructor(
    readonly app: Application,
    readonly cfg: TierConfig,
    readonly scenario: Scenario,
    readonly log: CommandLog,
  ) {
    const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
    if (gl) this.counter = new DrawCallCounter(gl);
  }

  get elapsedS(): number {
    return (performance.now() - this.startedAt) / 1000;
  }

  /** Seconds left in the throttle check, or 0. */
  get throttleLeftS(): number {
    return this.scenario.mode === "throttle" ? Math.max(0, this.scenario.minutes * 60 - this.elapsedS) : 0;
  }

  frame(frameMs: number, updateMs: number, info: FrameInfo): void {
    this.lastDrawCalls = this.counter ? this.counter.endFrame() : 0;
    if (this.finished) return;
    const now = performance.now();
    if (now - this.texCheckedAt > 1000) {
      this.texMB = textureMemoryMB(this.app.renderer).totalMB;
      this.texCheckedAt = now;
    }
    for (const c of this.log.between(this.loggedUpTo, now)) this.recorder.note(describeCommand(c.command));
    this.loggedUpTo = now;
    if (info.rebaked) this.recorder.note("ground rebake");
    if (info.cinematic) this.recorder.note("era cinematic");
    const row = this.recorder.add(
      { frameMs, updateMs, drawCalls: this.lastDrawCalls, visible: info.visibleSprites, particles: info.particles },
      now,
      { texMB: this.texMB, heapMB: heapMB(), tier: this.cfg.tier, mode: this.scenario.mode, phase: info.phase, raid: info.raid },
    );
    if (row) this.lastRow = row;
    if (this.scenario.mode === "throttle" && this.throttleLeftS <= 0) this.finished = true;
  }

  gate(): Check[] {
    return evaluateGate({
      mode: this.scenario.mode,
      summary: this.recorder.summary(),
      startupMs: this.startupMs,
      texMB: this.texMB,
      budgetMB: this.cfg.budgetMB,
      throttleMinutes: this.scenario.minutes,
    });
  }

  csv(): string {
    const s = this.recorder.summary();
    const gl = (this.app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    const gpu = gl && dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "unknown";
    const meta: Record<string, string | number> = {
      app: "Borrowed Time Phase 0 stress scene (stand-in art)",
      userAgent: navigator.userAgent,
      gpu,
      screen: `${screen.width}x${screen.height} @${window.devicePixelRatio}`,
      renderResolution: this.app.renderer.resolution,
      tier: this.cfg.tier,
      tierReason: this.tierReason,
      mode: this.scenario.mode,
      crowd: this.scenario.crowd ? "on" : "off",
      startupMs: this.startupMs,
      seconds: s.seconds,
      fpsMedian: s.fpsMedian,
      fpsWorstSecond: s.fpsWorstSecond,
      frameP50: s.p50,
      frameP95: s.p95,
      frameP99: s.p99,
      drawCallsMax: s.drawCallsMax,
      texMBMax: s.texMBMax,
      minuteFps: s.minuteFps.join(" "),
    };
    for (const c of this.gate()) meta[`gate_${c.id}`] = `${c.verdict}: ${c.measured}`;
    return toCsv(this.recorder.rows, meta);
  }

  filename(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `bt-phase0-${this.cfg.tier}-${this.scenario.mode}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
  }
}
