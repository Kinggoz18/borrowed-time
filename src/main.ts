import { Capacitor } from "@capacitor/core";
import { Application } from "pixi.js";
import { PerfRun } from "./perf/runner";
import type { Mode, Scenario, TierConfig } from "./render/config";
import { StressScene } from "./render/scene";
import { CommandLog } from "./sim/commands";

const HIGH: TierConfig = { tier: "high", dprCap: 2, bloom: true, bloomResolution: 0.5, particles: 300, villagers: 50, raiders: 24, boats: 6, puppets: true, atlas: "high", budgetMB: 128 };

declare global {
  interface Window {
    __bt?: { ready: boolean; startupMs: number; frames: number; scene?: StressScene; run?: PerfRun; error?: string };
  }
}

function readScenario(params: URLSearchParams): Scenario {
  const mode = (["loop", "worst", "throttle"].includes(params.get("mode") ?? "") ? params.get("mode") : "loop") as Mode;
  const minutes = Number(params.get("minutes") ?? "10");
  return { mode, crowd: params.get("crowd") !== "0", seed: Number(params.get("seed") ?? "1") || 1, minutes: minutes > 0 ? minutes : 10 };
}

function relaunch(change: Record<string, string>): void {
  const params = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(change)) params.set(k, v);
  location.search = params.toString();
}

async function boot(): Promise<void> {
  const host = document.getElementById("app");
  if (!host) return;
  const state: NonNullable<Window["__bt"]> = { ready: false, startupMs: 0, frames: 0 };
  window.__bt = state;
  const params = new URLSearchParams(location.search);
  const scenario = readScenario(params);
  const cfg = HIGH;
  const log = new CommandLog();
  log.append({ kind: "setMode", mode: scenario.mode }, performance.now());
  log.append({ kind: "setCrowd", on: scenario.crowd }, performance.now());
  const app = new Application();
  await app.init({
    resizeTo: host,
    preference: "webgl",
    antialias: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, cfg.dprCap),
    powerPreference: "high-performance",
    background: "#5e9a98",
  });
  host.appendChild(app.canvas);
  const scene = new StressScene(app, cfg, scenario);
  await scene.load();
  const run = new PerfRun(app, cfg, scenario, log);
  state.scene = scene;
  state.run = run;
  app.renderer.on("resize", () => scene.resize());
  let last = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    const info = scene.update((now - last) / 1000);
    const updateMs = performance.now() - now;
    if (state.ready) run.frame(now - last, updateMs, info);
    last = now;
    state.frames++;
    if (!state.ready && state.frames >= 2) {
      // Startup = navigation start to the second rendered frame of the full scene.
      state.ready = true;
      state.startupMs = Math.round(now);
      run.startupMs = state.startupMs;
      if (Capacitor.isNativePlatform()) void import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide());
    }
  });
  if (__PERF_HUD__) {
    const { mountHud } = await import("./perf/hud");
    mountHud({ run, log, relaunch });
  }
}

boot().catch((e: unknown) => {
  if (window.__bt) window.__bt.error = String(e);
  console.error(e);
});
