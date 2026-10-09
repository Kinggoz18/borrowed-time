import { Application } from "pixi.js";
import type { Mode, Scenario, TierConfig } from "./render/config";
import { StressScene } from "./render/scene";

const HIGH: TierConfig = { tier: "high", dprCap: 2, bloom: true, bloomResolution: 0.5, particles: 300, villagers: 50, raiders: 24, boats: 6, puppets: true, atlas: "high", budgetMB: 128 };

declare global {
  interface Window {
    __bt?: { ready: boolean; startupMs: number; frames: number; scene?: StressScene; error?: string };
  }
}

function readScenario(params: URLSearchParams): Scenario {
  const mode = (["loop", "worst", "throttle"].includes(params.get("mode") ?? "") ? params.get("mode") : "loop") as Mode;
  const minutes = Number(params.get("minutes") ?? "10");
  return { mode, crowd: params.get("crowd") !== "0", seed: Number(params.get("seed") ?? "1") || 1, minutes: minutes > 0 ? minutes : 10 };
}

async function boot(): Promise<void> {
  const host = document.getElementById("app");
  if (!host) return;
  const state: NonNullable<Window["__bt"]> = { ready: false, startupMs: 0, frames: 0 };
  window.__bt = state;
  const params = new URLSearchParams(location.search);
  const scenario = readScenario(params);
  const cfg = HIGH;
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
  state.scene = scene;
  app.renderer.on("resize", () => scene.resize());
  let last = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    scene.update((now - last) / 1000);
    last = now;
    state.frames++;
    if (!state.ready && state.frames >= 2) {
      state.ready = true;
      state.startupMs = Math.round(now);
    }
  });
}

boot().catch((e: unknown) => {
  if (window.__bt) window.__bt.error = String(e);
  console.error(e);
});
