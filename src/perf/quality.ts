/**
 * Quality tiers (FINAL_PLAN_BT.md §5 budgets): presets, auto-detection from the GPU and RAM, and
 * the runtime auto-drop when frames run long.
 */
import type { Tier, TierConfig } from "../render/config";

export const TIERS: Record<Tier, TierConfig> = {
  high: { tier: "high", dprCap: 2, bloom: true, bloomResolution: 0.5, particles: 300, villagers: 50, raiders: 24, boats: 6, puppets: true, atlas: "high", budgetMB: 128 },
  mid: { tier: "mid", dprCap: 1.5, bloom: false, bloomResolution: 0.5, particles: 300, villagers: 32, raiders: 16, boats: 6, puppets: true, atlas: "high", budgetMB: 128 },
  // The low tier loads the half-resolution export (2 px lines), drops bloom and halves particles.
  low: { tier: "low", dprCap: 1, bloom: false, bloomResolution: 0.5, particles: 150, villagers: 20, raiders: 12, boats: 6, puppets: false, atlas: "low", budgetMB: 80 },
};

export interface DeviceInfo {
  gpu: string;
  /** navigator.deviceMemory in GB (Chrome rounds to 0.25-8); 0 when unknown. */
  memoryGB: number;
  cores: number;
  mobile: boolean;
}

export interface Detection {
  tier: Tier;
  reason: string;
}

const LOW_GPU = [/Mali-(T\d+|G3\d|G5\d)\b/i, /Adreno[^\d]*(3\d\d|4\d\d|5\d\d|6[0-2]\d)(?!\d)/i, /PowerVR/i, /SwiftShader|llvmpipe|Software/i];
const MID_GPU = [/Mali-G(6\d|7[0-8])\b/i, /Adreno[^\d]*(6[3-9]\d)(?!\d)/i];

export function detectTier(d: DeviceInfo): Detection {
  const gpu = d.gpu || "unknown";
  let tier: Tier = "high";
  let reason = `${d.mobile ? "phone" : "desktop"}, GPU ${gpu}`;
  if (LOW_GPU.some((r) => r.test(gpu))) tier = "low";
  else if (MID_GPU.some((r) => r.test(gpu))) tier = "mid";
  else if (d.mobile && gpu === "unknown") tier = "mid";
  if (d.memoryGB > 0 && d.memoryGB <= 3) {
    tier = "low";
    reason += `, ${d.memoryGB} GB RAM`;
  } else if (d.memoryGB > 0 && d.memoryGB <= 4 && tier === "high") {
    tier = "mid";
    reason += `, ${d.memoryGB} GB RAM`;
  }
  if (d.mobile && d.cores > 0 && d.cores <= 4 && tier !== "low") {
    tier = "low";
    reason += `, ${d.cores} cores`;
  }
  return { tier, reason };
}

export function lowerTier(t: Tier): Tier | null {
  return t === "high" ? "mid" : t === "mid" ? "low" : null;
}

/**
 * Auto-drop: after a warm-up, if p95 frame time stays above the limit (40 fps) for `window`
 * seconds in a row, step down one tier. Never steps up mid-session.
 */
export class AutoDrop {
  private bad = 0;
  private seen = 0;
  constructor(
    private readonly limitMs = 25,
    private readonly window = 3,
    private readonly warmup = 5,
  ) {}
  /** Feed one per-second row's p95; returns true when the tier should drop. */
  push(p95: number): boolean {
    this.seen++;
    if (this.seen <= this.warmup) return false;
    this.bad = p95 > this.limitMs ? this.bad + 1 : 0;
    if (this.bad >= this.window) {
      this.bad = 0;
      return true;
    }
    return false;
  }
}

export function readDevice(gl: WebGLRenderingContext | null): DeviceInfo {
  const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
  const gpu = gl ? String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "unknown";
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { gpu, memoryGB: nav.deviceMemory ?? 0, cores: nav.hardwareConcurrency ?? 0, mobile: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) };
}

/** Probe the GPU with a throwaway context before the renderer exists. */
export function probeDevice(): DeviceInfo {
  const c = document.createElement("canvas");
  const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
  const info = readDevice(gl);
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  return info;
}
