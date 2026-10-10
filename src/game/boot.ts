/** Boots the game: storage, settings, quality tier, the Pixi island, the session and the UI. */
import { Application } from "pixi.js";
import { newGame } from "../core/engine";
import { SAVE_KEY } from "../core/save";
import { cloneState } from "../core/snapshot";
import type { IslandState } from "../core/state";
import { detectTier, probeDevice, TIERS } from "../perf/quality";
import { createStorage } from "../platform/storage";
import { Haptics, Sfx } from "../platform/sfx";
import type { Tier } from "../render/config";
import { IslandView } from "../render/island/view";
import { GameUI } from "../ui/app";
import "../ui/ui.css";
import { Session } from "./session";
import { applyOrientation, orientFromSettings } from "../platform/orientation";
import { loadSettings } from "./settings";

export interface GameHooks {
  ready: boolean;
  tier: Tier;
  storage: string;
  screen: () => string;
  state: () => IslandState | null;
  played: () => string[];
  stats: () => ReturnType<IslandView["stats"]>;
  lotToScreen: (key: string) => { x: number; y: number };
  zoomToLots: () => void;
  showLot: (key: string) => void;
  fps: () => number;
  error?: string;
}

export async function bootGame(): Promise<void> {
  const host = document.getElementById("app")!;
  const params = new URLSearchParams(location.search);
  const kv = await createStorage();
  const settings = await loadSettings(kv);
  void applyOrientation(orientFromSettings(settings));
  const asked = params.get("tier") ?? (settings.quality !== "auto" ? settings.quality : null);
  const tier: Tier = asked === "low" || asked === "mid" || asked === "high" ? asked : detectTier(probeDevice()).tier;
  const cfg = TIERS[tier];
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
  // the world is pixel art: never let the browser smooth it when the canvas is scaled to the screen
  app.canvas.style.imageRendering = "pixelated";
  const view = new IslandView(app, cfg);
  await view.init();
  const sfx = new Sfx();
  const haptics = new Haptics();
  sfx.setMixer({ sound: settings.sound, music: settings.music, sfxVol: settings.sfxVol, musicVol: settings.musicVol });
  haptics.enabled = settings.haptics;
  sfx.setScene("menu");
  sfx.unlock();
  addEventListener("pointerdown", () => sfx.unlock(), { once: true });
  const dev = import.meta.env.DEV;
  const ui = new GameUI(document.body, { view, sfx, haptics, kv, settings, dev, onQuality: () => location.reload() });

  let session: Session | null = await Session.load(kv);
  const backdrop = () => (session ? session.state : newGame({ seed: 7 }));
  const home = () => {
    view.sync(backdrop());
    view.fit(true);
    ui.showHome(!!session, kv.kind === "memory" ? "Saving is off on this device: storage is blocked." : "");
  };
  ui.d.onHome = home;
  ui.d.onContinue = () => session && ui.startPlay(session);
  ui.d.onNew = () => {
    session = Session.fresh((Date.now() % 1_000_000) + 1, kv, "New Patience");
    void session.save();
    view.fit(true);
    ui.startPlay(session);
  };
  ui.d.onReset = async () => {
    await kv.del(SAVE_KEY);
    session = null;
    home();
  };
  // dev grants change the island outside the command log: start a new replay checkpoint
  ui.d.onDevChange = () => {
    if (!session) return;
    const d = session.data;
    d.checkpoint = cloneState(d.state);
    d.checkpointSeq = d.seq;
    d.commands = [];
    void session.save();
  };
  home();

  const save = () => void session?.save();
  addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      save();
      sfx.suspend();
    } else sfx.resume();
  });

  let fps = 60;
  app.ticker.add((t) => {
    fps = fps * 0.95 + (1000 / Math.max(1, t.deltaMS)) * 0.05;
    if (ui.screen !== "play" || !session) return;
    session.update(t.deltaMS);
    const st = session.state;
    if (st.phase === "day") view.setLight(session.dayProgress(), false);
    ui.updateHud();
  });

  const hooks: GameHooks = {
    ready: true,
    tier,
    storage: kv.kind,
    screen: () => ui.screen,
    state: () => session?.state ?? null,
    played: () => sfx.played.slice(),
    stats: () => view.stats(),
    lotToScreen: (k) => view.lotToScreen(k),
    zoomToLots: () => view.zoomToLots(),
    showLot: (k) => view.showLot(k),
    fps: () => Math.round(fps),
  };
  (window as unknown as { __bt: GameHooks }).__bt = hooks;
  if ((await import("@capacitor/core")).Capacitor.isNativePlatform()) void import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide());
}
