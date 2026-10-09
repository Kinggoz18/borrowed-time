/**
 * The island on screen: ground, ring, buildings, people, boats and the night's raid, drawn from
 * the boot-time atlas with plain sprites (one batch per atlas page). Reads IslandState; never
 * changes it. Animations are presentation only: the rules already resolved before they play.
 */
import { Application, Container, Graphics, Sprite, TilingSprite, type FederatedPointerEvent } from "pixi.js";
import type { RaidResult } from "../../core/engine";
import { kij } from "../../core/rules";
import type { IslandState } from "../../core/state";
import { buildAtlas, type IslandAtlas } from "../../art/island/atlas";
import type { Job } from "../../art/island/scenery";
import type { TierConfig } from "../config";
import { BATTLE_RESOLVED_EVENT, battleTimeline, boatCount, prefersReducedMotion, raiderCount } from "./battle";
import { cellAt, cellFront, eraOf, layoutIsland, TH, TW, visibleFigures, type IslandLayout, type Placed } from "./layout";
import { toTextures, type IslandTextures } from "./textures";

interface Walker {
  sp: Sprite;
  job: Job;
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  wait: number;
  phase: number;
}
interface Tween {
  t: number;
  dur: number;
  step: (u: number) => void;
  done?: () => void;
}

const JOB_OF: Record<string, Job> = { field: "field", cottage: "field", workshop: "clockworks", tower: "watch", bank: "trade", trade: "trade", lantern: "clockworks" };

/** Landscape screen furniture (ui.css): the HUD strip on top and the button rail on the right. */
const HUD_TOP = 64;
const RAIL_RIGHT = 104;
/** Gameplay camera starts this much closer than "whole island fits" (owner: too far out). */
export const PLAY_ZOOM = 1.6;

export class IslandView {
  readonly world = new Container();
  private ground = new Container();
  private objects = new Container();
  private sea = new Container();
  private overlay = new Container();
  private grain!: TilingSprite;
  private wash = new Graphics();
  private select = new Graphics();
  private shadow = new Graphics();
  private tex!: IslandTextures;
  private atlas!: IslandAtlas;
  private thumbs = new Map<string, string>();
  private era = "";
  private layout!: IslandLayout;
  private sprites = new Map<string, Sprite>();
  private walkers: Walker[] = [];
  private tweens: Tween[] = [];
  private boats: Sprite[] = [];
  private zoom = 1;
  private fitZoom = 1;
  private cx = 0;
  private cy = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragFrom: { x: number; y: number; cx: number; cy: number; dist: number; zoom: number; moved: boolean } | null = null;
  /** 0..1 through the day (dawn → dusk), drives the tint and the gnomon shadow */
  private light = 0.2;
  private night = false;
  onTapLot: (key: string) => void = () => undefined;
  onTapTent: () => void = () => undefined;
  /** Fired once the clash outcome is on screen, before damage or seizure visuals. */
  onBattleResolved: ((res: RaidResult) => void) | null = null;

  constructor(
    private app: Application,
    private cfg: TierConfig,
  ) {
    this.objects.sortableChildren = true;
    this.world.addChild(this.sea, this.ground, this.shadow, this.select, this.objects);
    app.stage.addChild(this.world, this.overlay);
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", (e) => this.down(e));
    app.stage.on("pointermove", (e) => this.move(e));
    app.stage.on("pointerup", (e) => this.up(e));
    app.stage.on("pointerupoutside", (e) => this.up(e));
    app.stage.on("wheel", (e) => this.zoomAt(e.global.x, e.global.y, Math.exp(-e.deltaY * 0.0015)));
    app.ticker.add((t) => this.update(t.deltaMS / 1000));
    app.renderer.on("resize", () => this.fit(false));
  }

  /** Builds (or rebuilds, on an era change) the atlas for this state's era. */
  private ensureAtlas(st: IslandState): void {
    const era = eraOf(st.tier);
    if (era === this.era) return;
    this.tex?.destroy();
    const s = this.cfg.atlas === "low" ? 1 : 2;
    this.atlas = buildAtlas(era, s);
    this.thumbs.clear();
    this.tex = toTextures(this.atlas);
    this.era = era;
    if (!this.grain) {
      this.grain = new TilingSprite({ texture: this.tex.grain, width: this.app.screen.width, height: this.app.screen.height });
      this.grain.alpha = 0.07;
      this.grain.eventMode = "none";
      this.overlay.addChild(this.grain, this.wash);
    } else this.grain.texture = this.tex.grain;
    for (const w of this.walkers) w.sp.destroy();
    this.walkers = [];
    for (const b of this.boats) b.destroy();
    this.boats = [];
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    this.ground.removeChildren().forEach((c) => c.destroy());
  }

  /** Re-lays the island for the state. Cheap enough to call after every command. */
  sync(st: IslandState, opts: { dusk?: boolean } = {}): void {
    this.ensureAtlas(st);
    const prevR = this.layout?.r;
    this.layout = layoutIsland(st, opts);
    if (prevR !== this.layout.r || this.ground.children.length === 0) {
      this.ground.removeChildren().forEach((c) => c.destroy());
      this.drawSea();
    }
    if (!this.ground.children.length) this.addAll(this.ground, this.layout.ground);
    // ground variant changes (grey land) without rebuilding: swap textures
    const gs = this.ground.children as Sprite[];
    this.layout.ground.forEach((p, i) => {
      if (gs[i]) gs[i].texture = this.tex.get(p.frame);
    });
    const keep = new Set<string>();
    for (const p of [...this.layout.ring, ...this.layout.things]) {
      const id = `${p.key ?? p.frame}@${p.x},${p.y}`;
      keep.add(id);
      let sp = this.sprites.get(id);
      if (!sp) {
        sp = new Sprite(this.tex.get(p.frame));
        this.objects.addChild(sp);
        this.sprites.set(id, sp);
      } else sp.texture = this.tex.get(p.frame);
      sp.position.set(p.x, p.y);
      sp.scale.set(p.scale ?? 1);
      sp.alpha = 1;
      sp.zIndex = p.z;
    }
    for (const [id, sp] of this.sprites)
      if (!keep.has(id)) {
        sp.destroy();
        this.sprites.delete(id);
      }
    this.syncWalkers(st);
    if (prevR !== this.layout.r) this.fit(true);
  }

  private addAll(into: Container, list: Placed[]): void {
    for (const p of list) {
      const sp = new Sprite(this.tex.get(p.frame));
      sp.position.set(p.x, p.y);
      into.addChild(sp);
    }
  }

  private drawSea(): void {
    this.sea.removeChildren().forEach((c) => c.destroy());
    const b = this.layout.bounds;
    for (let n = 0; n < 14; n++) {
      const f = new Sprite(this.tex.get("fx/foam"));
      const a = (n / 14) * Math.PI * 2;
      f.position.set(b.x + b.w / 2 + Math.cos(a) * b.w * 0.55, b.y + b.h / 2 + Math.sin(a) * b.h * 0.55);
      f.alpha = 0.7;
      this.sea.addChild(f);
    }
  }

  private syncWalkers(st: IslandState): void {
    const want = visibleFigures(st.pop, this.cfg.villagers);
    const jobs: Job[] = [];
    for (const b of Object.values(st.lots)) if (b) jobs.push(JOB_OF[b.type] ?? "trade");
    if (!jobs.length) jobs.push("field");
    while (this.walkers.length > want) this.walkers.pop()!.sp.destroy();
    while (this.walkers.length < want) {
      const job = jobs[this.walkers.length % jobs.length];
      const sp = new Sprite(this.tex.get(`p/${job}/0`));
      const p = this.randomSpot();
      sp.position.set(p.x, p.y);
      this.objects.addChild(sp);
      this.walkers.push({ sp, job, x: p.x, y: p.y, tx: p.x, ty: p.y, speed: 14 + Math.random() * 8, wait: Math.random() * 2, phase: Math.random() });
    }
  }

  private randomSpot(): { x: number; y: number } {
    const r = this.layout.r;
    const i = (Math.random() * 2 - 1) * (r + 0.5), j = (Math.random() * 2 - 1) * (r + 0.5);
    const p = cellFront(i, j);
    return { x: p.x, y: p.y - TH / 2 };
  }

  /** 0 = dawn, 1 = dusk; night darkens further. */
  setLight(u: number, night = false): void {
    this.light = u;
    this.night = night;
  }

  // ---------- camera ----------
  fit(reset: boolean): void {
    const b = this.layout?.fitBounds;
    if (!b) return;
    const sw = this.app.screen.width, sh = this.app.screen.height;
    if (this.grain) {
      this.grain.width = sw;
      this.grain.height = sh;
    }
    const a = this.area();
    this.fitZoom = Math.min(a.w / b.w, a.h / b.h);
    if (reset || this.zoom < this.fitZoom) {
      // Play starts zoomed in so buildings and people read; pinch out to see the whole island.
      this.zoom = this.fitZoom * PLAY_ZOOM;
      this.cx = b.x + b.w / 2;
      this.cy = b.y + b.h / 2;
    }
    this.apply();
  }
  /** The part of the screen the island owns: below the top HUD, left of the button rail. */
  private area(): { x: number; y: number; w: number; h: number } {
    const { width, height } = this.app.screen;
    return { x: 0, y: HUD_TOP, w: Math.max(1, width - RAIL_RIGHT), h: Math.max(1, height - HUD_TOP) };
  }
  private glide: { x: number; y: number } | null = null;
  /** Glide the camera to a lot if it is off screen or under the HUD/rail (a new building is always seen). */
  reveal(key: string): void {
    const p = this.lotToScreen(key);
    const a = this.area();
    const m = 48;
    if (p.x > a.x + m && p.x < a.x + a.w - m && p.y > a.y + m && p.y < a.y + a.h - m) return;
    const [i, j] = kij(key);
    const f = cellFront(i, j);
    this.glide = { x: f.x, y: f.y - TH / 2 };
  }
  /** Glide so a lot sits in the middle of the island still visible left of a side sheet `cover` px wide. */
  focusLot(key: string, cover: number): void {
    const [i, j] = kij(key);
    const f = cellFront(i, j);
    const a = this.area();
    const want = (this.app.screen.width - cover) / 2;
    this.glide = { x: f.x - (want - (a.x + a.w / 2)) / this.zoom, y: f.y - TH / 2 };
  }
  /** Centre the camera on a lot (used by tests and to frame the next thing to do). */
  showLot(key: string): void {
    this.glide = null;
    const [i, j] = kij(key);
    const p = cellFront(i, j);
    this.cx = p.x;
    this.cy = p.y - TH / 2;
    this.apply();
  }
  private apply(): void {
    const b = this.layout.bounds;
    this.zoom = Math.max(this.fitZoom, Math.min(this.fitZoom * 5, this.zoom));
    // keep the island on screen
    this.cx = Math.max(b.x, Math.min(b.x + b.w, this.cx));
    this.cy = Math.max(b.y, Math.min(b.y + b.h, this.cy));
    this.world.scale.set(this.zoom);
    const a = this.area();
    this.world.position.set(a.x + a.w / 2 - this.cx * this.zoom, a.y + a.h / 2 - this.cy * this.zoom);
  }
  zoomAt(sx: number, sy: number, k: number): void {
    const wx = (sx - this.world.x) / this.zoom, wy = (sy - this.world.y) / this.zoom;
    this.zoom *= k;
    this.apply();
    const nx = (sx - this.world.x) / this.zoom, ny = (sy - this.world.y) / this.zoom;
    this.cx += wx - nx;
    this.cy += wy - ny;
    this.apply();
  }
  /** Lot width on screen in CSS px: below a finger's width a tap zooms instead of selecting. */
  lotScreenWidth(): number {
    return TW * this.zoom;
  }
  private down(e: FederatedPointerEvent): void {
    this.glide = null;
    this.pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
    const pts = [...this.pointers.values()];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    this.dragFrom = { x: e.global.x, y: e.global.y, cx: this.cx, cy: this.cy, dist, zoom: this.zoom, moved: false };
  }
  private move(e: FederatedPointerEvent): void {
    if (!this.pointers.has(e.pointerId) || !this.dragFrom) return;
    this.pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
    const pts = [...this.pointers.values()];
    const d = this.dragFrom;
    if (pts.length > 1 && d.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
      this.zoomAt(mx, my, (d.zoom * (dist / d.dist)) / this.zoom);
      d.moved = true;
      return;
    }
    const dx = e.global.x - d.x, dy = e.global.y - d.y;
    if (Math.hypot(dx, dy) > 8) d.moved = true;
    if (d.moved) {
      this.cx = d.cx - dx / this.zoom;
      this.cy = d.cy - dy / this.zoom;
      this.apply();
    }
  }
  private up(e: FederatedPointerEvent): void {
    const d = this.dragFrom;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size) return;
    this.dragFrom = null;
    if (!d || d.moved) return;
    this.tap(e.global.x, e.global.y);
  }
  /** World → cell under a screen point. */
  pick(sx: number, sy: number): string | null {
    const wx = (sx - this.world.x) / this.zoom, wy = (sy - this.world.y) / this.zoom;
    const t = this.layout.tent;
    if (Math.abs(wx - t.x) < TW * 0.6 && wy < t.y + 4 && wy > t.y - 70) return "tent";
    const c = cellAt(wx, wy);
    const key = `${c.i},${c.j}`;
    return key;
  }
  tap(sx: number, sy: number): void {
    const key = this.pick(sx, sy);
    if (key === "tent") return this.onTapTent();
    if (this.lotScreenWidth() < 34) {
      // too small to aim at: zoom toward the tap first (FINAL_PLAN_BT.md §6 tap-to-zoom)
      this.zoomAt(sx, sy, 48 / this.lotScreenWidth());
      return;
    }
    if (key) this.onTapLot(key);
  }
  /** Screen position (CSS px) of a lot's centre, for tests and UI anchoring. */
  lotToScreen(key: string): { x: number; y: number } {
    const [i, j] = kij(key);
    const p = cellFront(i, j);
    return { x: this.world.x + p.x * this.zoom, y: this.world.y + (p.y - TH / 2) * this.zoom };
  }
  zoomToLots(): void {
    this.zoom = Math.max(this.zoom, 56 / TW);
    this.apply();
  }
  highlight(key: string | null): void {
    this.select.clear();
    if (!key || !(key in (this.lastLots ?? {}))) return;
    const [i, j] = kij(key);
    const f = cellFront(i, j);
    this.select
      .poly([f.x, f.y - TH, f.x + TW / 2, f.y - TH / 2, f.x, f.y, f.x - TW / 2, f.y - TH / 2])
      .stroke({ width: 3, color: 0xd9a441, alpha: 1 });
  }
  private lastLots: Record<string, unknown> | null = null;
  setLots(st: IslandState): void {
    this.lastLots = st.lots;
  }

  // ---------- animation ----------
  tween(dur: number, step: (u: number) => void, done?: () => void): void {
    this.tweens.push({ t: 0, dur, step, done });
  }
  get busy(): boolean {
    return this.tweens.length > 0;
  }
  private update(dt: number): void {
    dt = Math.min(dt, 0.1);
    if (this.glide && !this.dragFrom) {
      const k = Math.min(1, dt * 6);
      const px = this.cx, py = this.cy;
      this.cx += (this.glide.x - this.cx) * k;
      this.cy += (this.glide.y - this.cy) * k;
      this.apply();
      // arrived, or held at the island's edge
      if (Math.hypot(this.glide.x - this.cx, this.glide.y - this.cy) < 0.5 || Math.hypot(this.cx - px, this.cy - py) < 0.05) this.glide = null;
    }
    for (const tw of this.tweens.slice()) {
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur);
      tw.step(u);
      if (u >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.done?.();
      }
    }
    for (const w of this.walkers) {
      if (this.night) {
        w.sp.visible = false;
        continue;
      }
      w.sp.visible = true;
      if (w.wait > 0) {
        w.wait -= dt;
        continue;
      }
      const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
      if (d < 1) {
        const p = this.randomSpot();
        w.tx = p.x;
        w.ty = p.y;
        w.wait = 0.5 + Math.random() * 2.5;
        continue;
      }
      const k = Math.min(1, (w.speed * dt) / d);
      w.x += dx * k;
      w.y += dy * k;
      w.phase += dt * 4;
      w.sp.texture = this.tex.get(`p/${w.job}/${Math.floor(w.phase) % 2}`);
      w.sp.scale.x = dx < 0 ? -1 : 1;
      w.sp.position.set(w.x, w.y);
      w.sp.zIndex = Math.round(((w.y - TH) / (TH / 2)) * 100) + 50;
    }
    // baked light, then a multiply-style tint over the day: warm dawn, white noon, amber dusk, blue night
    const u = this.light;
    const c = this.night ? 0x6f7fa6 : u < 0.15 ? mix(0xf3d9b8, 0xffffff, u / 0.15) : u < 0.75 ? 0xffffff : mix(0xffffff, 0xf0b58a, (u - 0.75) / 0.25);
    this.world.tint = c;
    // the gnomon's shadow sweeps west to east through the day
    const g = cellFront(0, 0);
    const a = Math.PI * (0.15 + 0.7 * u);
    this.shadow.clear();
    if (!this.night)
      this.shadow
        .moveTo(g.x, g.y - TH / 2)
        .lineTo(g.x - Math.cos(a) * 70, g.y - TH / 2 + Math.sin(a) * 22 - 6)
        .stroke({ width: 4, color: 0x3d3428, alpha: 0.3, cap: "round" });
  }

  /** A sprite on the island for an effect, depth-sorted with buildings. */
  private fx(frame: string, x: number, y: number, z = 100000): Sprite {
    const s = new Sprite(this.tex.get(frame));
    s.position.set(x, y);
    s.zIndex = z;
    this.objects.addChild(s);
    return s;
  }

  /** The raid, played back from the already-resolved result. Resolves when the playback ends. */
  async playRaid(res: RaidResult): Promise<void> {
    const g = this.layout.gate;
    const reduced = prefersReducedMotion();
    const ghost = res.kind === "ghosts";
    const n = boatCount(res.kind, res.boss, this.cfg.boats);
    const boats: Sprite[] = [];
    for (let k = 0; k < n; k++) {
      const b = this.fx("boat", g.x + 280 + k * 32, g.y + 130 + k * 36, -1);
      b.alpha = ghost ? 0.45 : 1;
      this.sea.addChild(b);
      boats.push(b);
    }
    const raiders: Sprite[] = [];
    const m = raiderCount(res.kind, res.boss, this.cfg.raiders);
    for (let k = 0; k < m; k++) {
      const r = this.fx("p/raider/0", g.x + 90 + (k % 4) * 10, g.y + 48 + Math.floor(k / 4) * 8);
      r.alpha = ghost ? 0.5 : 1;
      raiders.push(r);
    }
    const defenders: Sprite[] = [];
    for (let k = 0; k < Math.min(4, Math.max(2, this.walkers.length)); k++) {
      defenders.push(this.fx("p/watch/0", g.x - 70 + k * 14, g.y + 10, 80));
    }
    const ring: Sprite[] = [];
    const towers: Sprite[] = [];
    for (const [id, sp] of this.sprites) {
      if (id.includes("ring/") || id.includes("gate/")) ring.push(sp);
      if (id.includes("tower") || id.includes("watch")) towers.push(sp);
    }
    const towerY = towers.map((s) => s.y);
    const ringX = ring.map((s) => s.x);
    const wait = (dur: number, step: (u: number) => void) =>
      dur <= 0 ? Promise.resolve(step(1)) : new Promise<void>((done) => this.tween(dur, step, done));

    for (const beat of battleTimeline(res, reduced)) {
      if (beat.phase === "approach") {
        await wait(beat.dur, (u) => {
          const e = ease(u);
          boats.forEach((b, k) => b.position.set(g.x + 280 - 190 * e + k * 32, g.y + 130 - 80 * e + k * 36 + Math.sin(u * 8 + k) * 2));
        });
      } else if (beat.phase === "defend") {
        await wait(beat.dur, (u) => {
          ring.forEach((s) => (s.alpha = 0.75 + 0.25 * Math.sin(u * Math.PI * 4)));
          towers.forEach((s, k) => (s.y = towerY[k]! + Math.sin(u * Math.PI * 2 + k) * 2));
          defenders.forEach((d, k) => {
            d.x = g.x - 70 + k * 14 + 24 * u;
            d.y = g.y + 10 - 18 * u;
            d.texture = this.tex.get(`p/watch/${Math.floor(u * 6) % 2}`);
          });
        });
        ring.forEach((s) => (s.alpha = 1));
        towers.forEach((s, k) => (s.y = towerY[k]!));
      } else if (beat.phase === "clash") {
        const sparks: Sprite[] = [];
        await wait(beat.dur, (u) => {
          raiders.forEach((r, k) => {
            r.position.set(g.x + 90 - 70 * u + (k % 4) * 10, g.y + 48 - 32 * u + Math.floor(k / 4) * 8);
            r.texture = this.tex.get(`p/raider/${Math.floor(u * 10) % 2}`);
            r.scale.x = -1;
          });
          if (sparks.length < 3 && u > 0.2) {
            const t = towers[sparks.length] ?? defenders[sparks.length];
            const target = raiders[sparks.length % raiders.length];
            if (t && target) sparks.push(this.fx("fx/spark", t.x, t.y - 20));
          }
          sparks.forEach((s, k) => {
            const target = raiders[k % Math.max(1, raiders.length)];
            if (!target) return;
            s.x += (target.x - s.x) * 0.2;
            s.y += (target.y - 12 - s.y) * 0.2;
            s.alpha = 0.4 + 0.6 * Math.sin(u * 30 + k);
          });
        });
        sparks.forEach((s) => s.destroy());
      } else if (beat.phase === "outcome") {
        if (res.won) {
          const sparks = raiders.slice(0, 3).map((r) => this.fx("fx/spark", r.x, r.y - 14));
          await wait(beat.dur, (u) => {
            raiders.forEach((r) => {
              r.x += 1.2;
              r.alpha = 1 - u;
              r.scale.x = 1;
            });
            sparks.forEach((s) => (s.alpha = 1 - u));
          });
          sparks.forEach((s) => s.destroy());
        } else {
          await wait(beat.dur, (u) => {
            raiders.forEach((r, k) => {
              r.x -= 0.4;
              r.y -= 0.2;
              r.texture = this.tex.get(`p/raider/${Math.floor(u * 8 + k) % 2}`);
            });
            ring.forEach((s, k) => (s.x = ringX[k]! + Math.sin(u * 40) * 2));
            defenders.forEach((d) => (d.alpha = 1 - u * 0.5));
          });
          ring.forEach((s, k) => (s.x = ringX[k]!));
        }
      } else if (beat.phase === "resolved") {
        this.emitBattleResolved(res);
      } else if (beat.phase === "aftermath") {
        if (!res.won) {
          const fires: Sprite[] = [];
          for (const dmg of res.damaged.slice(0, 6)) {
            if (dmg.k === "pal") continue;
            const [i, j] = kij(dmg.k);
            const p = cellFront(i, j);
            fires.push(this.fx("fx/fire", p.x, p.y - 24), this.fx("fx/smoke", p.x + 4, p.y - 44));
          }
          await wait(beat.dur, (u) => {
            fires.forEach((f, k) => ((f.scale.y = 1 + 0.15 * Math.sin(u * 30 + k)), (f.alpha = u > 0.8 ? (1 - u) * 5 : 1)));
            raiders.forEach((r) => (r.alpha = (ghost ? 0.5 : 1) * (1 - u)));
          });
          fires.forEach((f) => f.destroy());
        } else await wait(Math.min(beat.dur, 0.4), () => undefined);
        raiders.forEach((r) => r.destroy());
        defenders.forEach((d) => d.destroy());
        await wait(reduced ? 0.05 : 1.0, (u) => boats.forEach((b, k) => (k > 0 || !res.won ? (b.alpha = (ghost ? 0.45 : 1) * (1 - u)) : (b.texture = this.tex.get("boat/beached")))));
        boats.forEach((b, k) => (k > 0 || !res.won ? b.destroy() : this.boats.push(b)));
        while (this.boats.length > 3) this.boats.shift()!.destroy();
      }
    }
  }

  private emitBattleResolved(res: RaidResult): void {
    this.onBattleResolved?.(res);
    try {
      dispatchEvent(new CustomEvent(BATTLE_RESOLVED_EVENT, { detail: { won: res.won, day: res.day, season: res.season, kind: res.kind, boss: res.boss } }));
    } catch {
      /* node tests have no window events */
    }
  }

  /** Hesper's men lift the seized building away, gently. */
  async playSeizure(key: string): Promise<void> {
    const sp = [...this.sprites.entries()].find(([id]) => id.startsWith(key + "@"))?.[1];
    const [i, j] = kij(key);
    const p = cellFront(i, j);
    const dust = this.fx("fx/dust", p.x, p.y - 10);
    const y0 = sp?.y ?? p.y;
    await new Promise<void>((done) =>
      this.tween(1.8, (u) => {
        if (sp) {
          sp.y = y0 - 40 * ease(u);
          sp.alpha = 1 - u;
        }
        dust.alpha = 1 - u;
        dust.scale.set(1 + u);
      }, done),
    );
    dust.destroy();
  }

  /** A paper-white wash: the new era settles in. */
  async playTierUp(): Promise<void> {
    const w = this.app.screen.width, h = this.app.screen.height;
    await new Promise<void>((done) =>
      this.tween(1.4, (u) => {
        this.wash.clear().rect(0, 0, w, h).fill({ color: 0xefe6d2, alpha: u < 0.4 ? u / 0.4 : (1 - u) / 0.6 });
      }, done),
    );
    this.wash.clear();
  }

  /** A short puff where something was built. */
  puff(key: string): void {
    const [i, j] = kij(key);
    const p = cellFront(i, j);
    const d = this.fx("fx/dust", p.x, p.y - 8);
    this.tween(0.7, (u) => ((d.alpha = 1 - u), d.scale.set(0.6 + u)), () => d.destroy());
  }

  /** A frame as an image URL for the DOM (build sheet thumbnails). */
  thumb(frame: string): string {
    let url = this.thumbs.get(frame);
    if (url) return url;
    const f = this.atlas.frames.get(frame);
    if (!f) return "";
    const c = document.createElement("canvas");
    c.width = f.w;
    c.height = f.h;
    c.getContext("2d")!.drawImage(this.atlas.pages[f.page], f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    url = c.toDataURL();
    this.thumbs.set(frame, url);
    return url;
  }
  get currentEra(): string {
    return this.era;
  }

  stats(): { sprites: number; walkers: number; zoom: number; fitZoom: number } {
    return { sprites: this.objects.children.length + this.ground.children.length, walkers: this.walkers.length, zoom: this.zoom, fitZoom: this.fitZoom };
  }
}

const ease = (u: number): number => 1 - (1 - u) * (1 - u);
function mix(a: number, b: number, u: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * u);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
