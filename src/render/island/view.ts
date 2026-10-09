/**
 * The island on screen: ground, ring, buildings, people, boats and the night's raid, drawn from
 * the boot-time atlas with plain sprites (one batch per atlas page). Reads IslandState; never
 * changes it. Animations are presentation only: the rules already resolved before they play.
 */
import { Application, Container, Graphics, Sprite, TilingSprite, type FederatedPointerEvent } from "pixi.js";
import type { RaidResult } from "../../core/engine";
import { kij } from "../../core/rules";
import type { IslandState } from "../../core/state";
import { buildAtlas } from "../../art/island/atlas";
import type { Job } from "../../art/island/scenery";
import type { TierConfig } from "../config";
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
const sleep = (view: IslandView, s: number) => new Promise<void>((res) => view.tween(s, () => undefined, res));

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
    this.tex = toTextures(buildAtlas(era, s));
    this.era = era;
    if (!this.grain) {
      this.grain = new TilingSprite({ texture: this.tex.grain, width: this.app.screen.width, height: this.app.screen.height });
      this.grain.alpha = 0.07;
      this.grain.eventMode = "none";
      this.overlay.addChild(this.grain, this.wash);
    } else this.grain.texture = this.tex.grain;
    for (const w of this.walkers) w.sp.destroy();
    this.walkers = [];
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
    const b = this.layout?.bounds;
    if (!b) return;
    const sw = this.app.screen.width, sh = this.app.screen.height;
    if (this.grain) {
      this.grain.width = sw;
      this.grain.height = sh;
    }
    this.fitZoom = Math.min(sw / b.w, (sh * 0.78) / b.h);
    if (reset || this.zoom < this.fitZoom) {
      this.zoom = this.fitZoom;
      this.cx = b.x + b.w / 2;
      this.cy = b.y + b.h / 2;
    }
    this.apply();
  }
  private apply(): void {
    const sw = this.app.screen.width, sh = this.app.screen.height;
    const b = this.layout.bounds;
    this.zoom = Math.max(this.fitZoom, Math.min(this.fitZoom * 5, this.zoom));
    // keep the island on screen
    this.cx = Math.max(b.x, Math.min(b.x + b.w, this.cx));
    this.cy = Math.max(b.y, Math.min(b.y + b.h, this.cy));
    this.world.scale.set(this.zoom);
    this.world.position.set(sw / 2 - this.cx * this.zoom, sh * 0.47 - this.cy * this.zoom);
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
    if (this.lotScreenWidth() < 44) {
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
    this.zoom = Math.max(this.zoom, 48 / TW);
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
    const n = Math.min(this.cfg.boats, res.boss ? 4 : 2);
    const boats: Sprite[] = [];
    for (let k = 0; k < n; k++) {
      const b = this.fx("boat", g.x + 260 + k * 30, g.y + 120 + k * 40, -1);
      this.sea.addChild(b);
      boats.push(b);
    }
    await new Promise<void>((done) =>
      this.tween(1.6, (u) => boats.forEach((b, k) => b.position.set(g.x + 260 - 170 * ease(u) + k * 30, g.y + 120 - 70 * ease(u) + k * 40)), done),
    );
    const raiders: Sprite[] = [];
    const m = Math.min(this.cfg.raiders, res.boss ? 10 : 5);
    for (let k = 0; k < m; k++) raiders.push(this.fx("p/raider/0", g.x + 80 + (k % 4) * 10, g.y + 40 + Math.floor(k / 4) * 8));
    await new Promise<void>((done) =>
      this.tween(1.2, (u) => raiders.forEach((r, k) => {
        r.position.set(g.x + 80 - 60 * u + (k % 4) * 10, g.y + 40 - 28 * u + Math.floor(k / 4) * 8);
        r.texture = this.tex.get(`p/raider/${Math.floor(u * 8) % 2}`);
        r.scale.x = -1;
      }), done),
    );
    if (res.won) {
      const sparks = raiders.slice(0, 3).map((r) => this.fx("fx/spark", r.x, r.y - 14));
      await sleep(this, 0.4);
      sparks.forEach((s) => s.destroy());
      await new Promise<void>((done) => this.tween(1, (u) => raiders.forEach((r) => ((r.alpha = 1 - u), (r.x += 1.5), (r.scale.x = 1))), done));
    } else {
      const fires: Sprite[] = [];
      for (const d of res.damaged.slice(0, 6)) {
        const [i, j] = kij(d.k);
        const p = cellFront(i, j);
        fires.push(this.fx("fx/fire", p.x, p.y - 24), this.fx("fx/smoke", p.x + 4, p.y - 44));
      }
      await new Promise<void>((done) => this.tween(1.8, (u) => fires.forEach((f, k) => ((f.scale.y = 1 + 0.15 * Math.sin(u * 30 + k)), (f.alpha = u > 0.8 ? (1 - u) * 5 : 1))), done));
      fires.forEach((f) => f.destroy());
      await new Promise<void>((done) => this.tween(0.8, (u) => raiders.forEach((r) => (r.alpha = 1 - u)), done));
    }
    raiders.forEach((r) => r.destroy());
    await new Promise<void>((done) => this.tween(1.2, (u) => boats.forEach((b, k) => (k > 0 || !res.won ? (b.alpha = 1 - u) : (b.texture = this.tex.get("boat/beached")))), done));
    boats.forEach((b, k) => (k > 0 || !res.won ? b.destroy() : this.boats.push(b)));
    // keep at most a few beached boats as trophies
    while (this.boats.length > 3) this.boats.shift()!.destroy();
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

  stats(): { sprites: number; walkers: number; zoom: number; fitZoom: number } {
    return { sprites: this.objects.children.length + this.ground.children.length, walkers: this.walkers.length, zoom: this.zoom, fitZoom: this.fitZoom };
  }
}

const ease = (u: number): number => 1 - (1 - u) * (1 - u);
function mix(a: number, b: number, u: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * u);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
