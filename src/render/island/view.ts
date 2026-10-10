/**
 * The island on screen: ground, ring, buildings, people, boats and the night's raid, drawn from
 * the boot-time atlas with plain sprites (one batch per atlas page). Reads IslandState; never
 * changes it. Animations are presentation only: the rules already resolved before they play.
 */
import { Application, Container, Graphics, MeshPlane, Sprite, TilingSprite, type PlaneGeometry, type FederatedPointerEvent, type Texture } from "pixi.js";
import type { RaidResult } from "../../core/engine";
import { kij } from "../../core/rules";
import type { IslandState } from "../../core/state";
import { buildAtlas, type IslandAtlas } from "../../art/island/atlas";
import { loadPixelArt, type PixelArt } from "../../art/pixel/pixelArt";
import { personFrameName, type Job, type PersonAnim, type PersonView } from "../../art/island/people";
import type { TierConfig } from "../config";
import { AMBIENT, crestAlpha, gullPose, gullSpecs, rng, seaState, seaStepsPerSecond, WAVE_DIR, type Ambient, type GullPose as GullPoseT, type GullSpec } from "./ambient";
import { BATTLE_RESOLVED_EVENT, battleTimeline, type BattlePhase, boatCount, prefersReducedMotion, raiderCount } from "./battle";
import { coastFor } from "./coast";
import { defaultZoom, MIN_LOT_PX } from "./framing";
import { arrowCount, monsterFrame, monsterHeight, monsterPose, monsterSize, type MonsterPose } from "./monster";
import { cellAt, cellFront, depth, eraOf, layoutIsland, lotCornerKeys, radius, TH, TW, visibleFigures, type IslandLayout, type Placed } from "./layout";
import { pickAt } from "./pick";
import { toTextures, type IslandTextures } from "./textures";
import { assignWalkers, blockedLots, facingOf, lotCentre, pathWorld, roadLots, route } from "./walkers";

interface Walker {
  sp: Sprite;
  job: Job;
  home: string;
  work: string;
  path: { x: number; y: number }[];
  pi: number;
  x: number;
  y: number;
  speed: number;
  wait: number;
  phase: number;
  mode: "toWork" | "work" | "idle" | "toHome" | "fadeOut" | "gone" | "fadeIn";
  view: PersonView;
}
/** A placed model: a plain sprite, or (High only) a mesh plane that sways its thatch and rags. */
type Piece = Sprite | MeshPlane;
interface Tween {
  t: number;
  dur: number;
  step: (u: number) => void;
  done?: () => void;
}

const SWAY_FRAME = /^(grey\/)?b\/colony\/(cottage|tower)\/|^tent$/;
const isWatch = (job: Job) => job === "watch" || job === "nell";

/** Play-area insets (CSS px); updated from the DOM HUD and rail each frame. */
let hudTop = 64;
let railRight = 104;
let barBottom = 0;

/** A pooled foam crest rolling toward the island during the raid. */
interface Crest {
  sp: Sprite;
  x: number;
  y: number;
  age: number;
  life: number;
  on: boolean;
}
interface Tuft {
  sp: Sprite;
  g: number;
  ph: number;
}
interface Puff {
  sp: Sprite;
  life: number;
  max: number;
  vy: number;
  x: number;
  y: number;
  on: boolean;
}

/** How far below the island's back corner the shadow's waterline sits (world units): it looms behind the land, which hides its hem. */
const SHADOW_BASE = 44;

export class IslandView {
  readonly world = new Container();
  private ground = new Container();
  private shore = new Container();
  private objects = new Container();
  private sea = new Container();
  private sky = new Container();
  private overlay = new Container();
  private wash = new Graphics();
  private select = new Graphics();
  private shadow = new Graphics();
  /** pixel art first, the procedural stand-ins (later eras) for what it does not draw yet */
  private tex = { get: (n: string): Texture => this.lookup(n), has: (n: string): boolean => this.art.has(n) || !!this.proc?.has(n) };
  private art!: PixelArt;
  private proc: IslandTextures | null = null;
  private atlas: IslandAtlas | null = null;
  /** Previous era atlases kept alive so Pixi can drop GPU bind groups without a warning. */
  private retired: IslandTextures[] = [];
  private thumbs = new Map<string, string>();
  private era = "";
  private layout!: IslandLayout;
  private sprites = new Map<string, Piece>();
  private meshes: { mesh: MeshPlane; ph: number }[] = [];
  private walkers: Walker[] = [];
  private tweens: Tween[] = [];
  private boats: Sprite[] = [];
  private boatBase = new Map<Sprite, number>();
  private amb: Ambient;
  private seaTile: TilingSprite | null = null;
  private glintTile: TilingSprite | null = null;
  private crests: Crest[] = [];
  private tufts: Tuft[] = [];
  private gulls: { sp: Sprite; spec: GullSpec }[] = [];
  private clouds: { sp: Sprite; x: number; y: number; v: number }[] = [];
  private swayers: { sp: Piece; frames: Texture[]; ph: number }[] = [];
  private flagTex: Texture[] = [];
  private smokeTex: Texture[] = [];
  private gullTex: Texture[] = [];
  private grassTex: Texture[][] = [];
  private flags: { sp: Sprite; ph: number }[] = [];
  private puffs: Puff[] = [];
  private hearths: { x: number; y: number }[] = [];
  private emitT = 0;
  private clock = 0;
  private seaStep = -1;
  private raidOn = false;
  private rand = rng(0x5ea);
  private wasNight = false;
  private lastSt: IslandState | null = null;
  /** The zoom actually drawn: a whole number of device pixels per art pixel (see snapZoom). */
  private zoom = 1;
  /** The zoom the player asked for (pinch and wheel accumulate here). */
  private rawZoom = 1;
  private fitZoom = 1;
  private ringFit = 1;
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
    this.amb = AMBIENT[cfg.tier];
    if (import.meta.env.DEV) (window as unknown as { __island: IslandView }).__island = this;
    this.objects.sortableChildren = true;
    this.sky.eventMode = "none";
    this.world.addChild(this.sea, this.ground, this.shore, this.shadow, this.select, this.objects, this.sky);
    app.stage.addChild(this.world, this.overlay);
    this.overlay.addChild(this.wash);
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

  /** Loads the pixel-art pages for this tier (call once, before the first sync). */
  async init(base = `${import.meta.env.BASE_URL}art`): Promise<void> {
    // Low and Medium draw the chunky grid (one art pixel = 1.33 world units, about 2 CSS px at play zoom);
    // High draws the finer grid. Either way the whole scene shares one pixel size.
    this.art = await loadPixelArt(base, this.cfg.tier === "high" ? "m" : "l", "colony");
    const a = this.art;
    this.flagTex = [0, 1, 2, 3].map((k) => a.get(`fx/flag/${k}`));
    this.smokeTex = [0, 1, 2, 3, 4].map((k) => a.get(`fx/smoke/${k}`));
    this.gullTex = [0, 1, 2, 3].map((k) => a.get(`fx/gull/${k}`));
    this.grassTex = [0, 1, 2, 3].map((g) => [0, 1, 2].map((k) => a.get(`fx/grass/${g}/${k}`)));
  }
  /** World units per art pixel at this tier. */
  get artUnit(): number {
    return this.art.u;
  }
  private lookup(n: string): Texture {
    if (this.art.has(n)) return this.art.get(n);
    if (this.proc?.has(n)) return this.proc.get(n);
    throw new Error(`missing frame ${n}`);
  }
  /** Snap a world coordinate to the art-pixel lattice so every sprite shares one pixel grid. */
  private snap(v: number): number {
    const u = this.art.u;
    return Math.round(v / u) * u;
  }

  /** Per era: the pixel pages plus a procedural atlas for whatever they do not draw yet. */
  private ensureAtlas(st: IslandState): void {
    const era = eraOf(st.tier);
    if (era === this.era) return;
    this.releaseAtlasSprites();
    this.art.alias(era);
    void this.art.ensureEra(era);
    const old = this.proc;
    const s = this.cfg.atlas === "low" ? 1 : 2;
    this.atlas = buildAtlas(era, s, undefined, 2048, (n) => !this.art.has(n));
    this.proc = this.atlas.frames.size ? toTextures(this.atlas) : null;
    if (!this.proc) this.atlas = null;
    this.thumbs.clear();
    this.era = era;
    if (old) this.retired.push(old);
  }
  /** Drop every sprite that still holds an atlas texture before the sources are destroyed. */
  private releaseAtlasSprites(): void {
    this.clearFx();
    for (const w of this.walkers) w.sp.destroy();
    this.walkers = [];
    for (const b of this.boats) b.destroy();
    this.boats = [];
    this.boatBase.clear();
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    this.meshes = [];
    this.ground.removeChildren().forEach((c) => c.destroy());
    this.shore.removeChildren().forEach((c) => c.destroy());
    this.clearSea();
  }
  private clearSea(): void {
    this.sea.removeChildren().forEach((c) => c.destroy());
    this.sky.removeChildren().forEach((c) => c.destroy());
    this.seaTile = this.glintTile = null;
    this.crests = [];
    this.tufts.forEach((t) => t.sp.destroy());
    this.tufts = [];
    this.gulls = [];
    this.clouds = [];
    this.seaStep = -1;
  }

  /** Re-lays the island for the state. Cheap enough to call after every command. */
  sync(st: IslandState, opts: { dusk?: boolean } = {}): void {
    this.lastState = st;
    this.ensureAtlas(st);
    const prevR = this.layout?.r;
    this.layout = layoutIsland(st, { ...opts, pixel: (f) => this.art.has(f), shoreFrame: (m) => this.art.shoreFrame(m) });
    if (prevR !== this.layout.r || this.ground.children.length === 0) {
      this.ground.removeChildren().forEach((c) => c.destroy());
      this.shore.removeChildren().forEach((c) => c.destroy());
      this.addAll(this.ground, this.layout.ground);
      this.addAll(this.shore, this.layout.shore);
      this.drawSea(st);
    }
    // ground variant changes (grey land) without rebuilding: swap textures
    const gs = this.ground.children as Sprite[];
    this.layout.ground.forEach((p, i) => {
      if (gs[i]) gs[i].texture = this.tex.get(p.frame);
    });
    const keep = new Set<string>();
    this.swayers = [];
    for (const p of [...this.layout.ring, ...this.layout.things]) {
      const id = `${p.key ?? p.frame}@${p.x},${p.y}`;
      keep.add(id);
      let sp = this.sprites.get(id);
      if (!sp) {
        sp = this.amb.mesh && SWAY_FRAME.test(p.frame) ? this.makeMesh(p) : new Sprite(this.tex.get(p.frame));
        this.objects.addChild(sp);
        this.sprites.set(id, sp);
      } else sp.texture = this.tex.get(p.frame);
      sp.position.set(p.x, p.y);
      sp.scale.set(p.scale ?? 1);
      sp.alpha = 1;
      sp.zIndex = p.z;
      if (this.art.has(`${p.frame}/s1`)) this.swayers.push({ sp, frames: [this.tex.get(p.frame), this.art.get(`${p.frame}/s1`), this.art.get(`${p.frame}/s2`)], ph: Math.abs(Math.round(p.x * 7 + p.y * 3)) % 3 });
    }
    for (const [id, sp] of this.sprites)
      if (!keep.has(id)) {
        sp.destroy();
        this.sprites.delete(id);
      }
    this.meshes = this.meshes.filter((m) => !m.mesh.destroyed);
    this.syncWalkers(st);
    this.syncFx();
    if (prevR !== this.layout.r) this.fit(true);
  }

  /** High: a 2x6 plane over the model; the rows near the roof shift by whole art pixels (see stepWorldFx). */
  private makeMesh(p: Placed): MeshPlane {
    const t = this.tex.get(p.frame);
    const m = new MeshPlane({ texture: t, verticesX: 2, verticesY: 6 });
    m.pivot.set(t.width * t.defaultAnchor!.x, t.height * t.defaultAnchor!.y);
    m.eventMode = "none";
    this.meshes.push({ mesh: m, ph: Math.abs(p.x * 0.011 + p.y * 0.007) });
    return m;
  }

  private addAll(into: Container, list: Placed[]): void {
    for (const p of list) {
      const sp = new Sprite(this.tex.get(p.frame));
      sp.position.set(p.x, p.y);
      into.addChild(sp);
    }
  }

  /** The sea: one tiling sprite sized to the screen, the raid's crest pool, gulls, cloud shadows, grass tufts. */
  private drawSea(st: IslandState): void {
    this.clearSea();
    const b = this.layout.fitBounds;
    this.seaTile = new TilingSprite({ texture: this.art.calm[0], width: 64, height: 64 });
    this.seaTile.eventMode = "none";
    this.sea.addChild(this.seaTile);
    if (this.amb.glint) {
      this.glintTile = new TilingSprite({ texture: this.art.glint, width: 64, height: 64 });
      this.glintTile.alpha = 0.55;
      this.glintTile.eventMode = "none";
      this.sea.addChild(this.glintTile);
    }
    for (let k = 0; k < this.amb.crests; k++) {
      const sp = new Sprite(this.art.get(`fx/crest/${k % 4}`));
      sp.visible = false;
      this.sea.addChild(sp);
      this.crests.push({ sp, x: 0, y: 0, age: 0, life: 1, on: false });
    }
    gullSpecs(this.amb.gulls, b.y + b.h * 0.05, b.h * 0.55).forEach((spec, k) => {
      const sp = new Sprite(this.art.get(`fx/gull/${k % 4}`));
      this.sky.addChild(sp);
      this.gulls.push({ sp, spec });
    });
    for (let k = 0; k < this.amb.clouds; k++) {
      const sp = new Sprite(this.art.get(`fx/cloud/${k % 2}`));
      sp.alpha = 0.5;
      this.sky.addChild(sp);
      this.clouds.push({ sp, x: b.x + b.w * (0.2 + 0.5 * k), y: b.y + b.h * (0.3 + 0.25 * k), v: -(3 + k) });
    }
    this.scatterTufts(st);
    this.stepSea(true);
    this.applyCamera();
  }

  /** Grass tufts on the open meadow, placed once per layout by cell hash (never on lots, ring, gate or tent). */
  private scatterTufts(st: IslandState): void {
    const r = this.layout.r;
    const coast = coastFor(r);
    const cand: { i: number; j: number; h: number }[] = [];
    for (const { i, j } of coast.cells) {
      const m = Math.max(Math.abs(i), Math.abs(j));
      if (m < r + 2 || `${i},${j}` in st.lots) continue;
      if (Math.abs(i - (r + 2)) <= 1 && Math.abs(j - (-r + 1)) <= 1) continue; // tent
      if (j === 0 && i >= r + 1) continue; // gate and road
      if (coast.sandy(i, j)) continue;
      cand.push({ i, j, h: ((i * 73856093) ^ (j * 19349663)) >>> 0 });
    }
    cand.sort((a, b) => (a.h % 977) - (b.h % 977));
    for (const c of cand.slice(0, this.amb.tufts)) {
      const g = c.h % 4, o = (c.h >>> 4) % 17, q = (c.h >>> 9) % 9;
      const f = cellFront(c.i, c.j);
      const sp = new Sprite(this.art.get(`fx/grass/${g}/1`));
      sp.position.set(this.snap(f.x + (o - 8) * 2.2), this.snap(f.y - TH / 2 + (q - 4) * 1.6));
      sp.zIndex = depth(c.i, c.j, 1);
      this.objects.addChild(sp);
      this.tufts.push({ sp, g, ph: (c.h >>> 13) % 3 });
    }
  }

  private syncWalkers(st: IslandState): void {
    this.lastSt = st;
    const plans = assignWalkers(st, visibleFigures(st.pop, this.cfg.villagers));
    while (this.walkers.length > plans.length) this.walkers.pop()!.sp.destroy();
    while (this.walkers.length < plans.length) {
      const plan = plans[this.walkers.length];
      const p = lotCentre(plan.home);
      const sp = new Sprite(this.personTex(plan.job, "idle", "se", 0));
      sp.position.set(p.x, p.y);
      this.objects.addChild(sp);
      this.walkers.push({
        sp, job: plan.job, home: plan.home, work: plan.work, path: [], pi: 0,
        x: p.x, y: p.y, speed: 16 + Math.random() * 8, wait: 0, phase: Math.random(),
        mode: this.night ? (isWatch(plan.job) ? "idle" : "gone") : "toWork", view: "se",
      });
    }
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i], plan = plans[i];
      const moved = w.home !== plan.home || w.work !== plan.work || w.job !== plan.job;
      w.job = plan.job;
      w.home = plan.home;
      w.work = plan.work;
      if (moved && (w.mode === "toWork" || w.mode === "toHome" || w.mode === "idle")) this.beginWalk(w, w.mode === "toHome" ? w.home : w.work);
    }
  }

  private personTex(job: Job, anim: PersonAnim, view: PersonView, frame: number) {
    const name = personFrameName(job, anim, view, frame);
    return this.tex.has(name) ? this.tex.get(name) : this.tex.get(`p/${job}/${frame % 2}`);
  }

  private beginWalk(w: Walker, dest: string): void {
    if (!this.lastSt) return;
    const from = this.nearLot(w);
    const allow = new Set([w.home, w.work, dest]);
    const lots = route(from, dest, blockedLots(this.lastSt, allow), roadLots(this.lastSt), radius(this.lastSt.tier));
    w.path = pathWorld(lots);
    w.pi = 0;
    w.mode = dest === w.home ? "toHome" : "toWork";
    w.wait = 0;
  }

  private nearLot(w: Walker): string {
    const c = cellAt(w.x, w.y + TH / 2);
    const k = `${c.i},${c.j}`;
    return this.lastSt && k in this.lastSt.lots ? k : w.home;
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
    const pb = this.layout.playBounds;
    const a = this.area();
    this.fitZoom = Math.min(a.w / b.w, a.h / b.h);
    this.ringFit = Math.min(a.w / pb.w, a.h / pb.h);
    if (reset || !this.userCam || this.rawZoom < this.fitZoom) {
      this.userCam = false;
      // Play starts zoomed in so buildings and people read; pinch out to see the whole island and its sea.
      this.rawZoom = defaultZoom({ ringFit: this.ringFit, fitZoom: this.fitZoom, per: this.app.renderer.resolution * this.art.u });
      this.cx = pb.x + pb.w / 2;
      this.cy = pb.y + pb.h / 2;
    }
    this.apply();
  }
  /** The part of the screen the island owns: below the top HUD, left of the button rail. */
  /** Match the real HUD and action-rail rects from the DOM (safe-area aware). */
  setPlayInsets(top: number, right: number, bottom = 0): void {
    const moved = Math.abs(top - hudTop) > 0.5 || Math.abs(right - railRight) > 0.5 || Math.abs(bottom - barBottom) > 0.5;
    hudTop = top;
    railRight = right;
    barBottom = bottom;
    // the bar or rail changed size (first frame, rotation): an untouched camera re-frames to the new play area
    if (moved && !this.userCam && this.layout) this.fit(false);
  }
  /** True once the player has panned or zoomed; until then the default framing follows the screen. */
  private userCam = false;
  private area(): { x: number; y: number; w: number; h: number } {
    const { width, height } = this.app.screen;
    return { x: 0, y: hudTop, w: Math.max(1, width - railRight), h: Math.max(1, height - hudTop - barBottom) };
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
    this.userCam = true;
    this.glide = { x: f.x, y: f.y - TH / 2 };
  }
  /** Glide so a lot sits in the middle of the island still visible left of a side sheet `cover` px wide. */
  focusLot(key: string, cover: number): void {
    const [i, j] = kij(key);
    const f = cellFront(i, j);
    const a = this.area();
    const want = (this.app.screen.width - cover) / 2;
    this.userCam = true;
    this.glide = { x: f.x - (want - (a.x + a.w / 2)) / this.zoom, y: f.y - TH / 2 };
  }
  get playLayout(): IslandLayout | null {
    return this.layout;
  }

  focusWorld(x: number, y: number): void {
    this.glide = { x, y };
  }

  /** Centre the camera on a lot (used by tests and to frame the next thing to do). */
  showLot(key: string): void {
    this.glide = null;
    this.userCam = true;
    const [i, j] = kij(key);
    const p = cellFront(i, j);
    this.cx = p.x;
    this.cy = p.y - TH / 2;
    this.apply();
  }
  private apply(): void {
    const b = this.layout.bounds;
    this.rawZoom = Math.max(this.fitZoom, Math.min(Math.max(this.fitZoom, this.ringFit * 5, (2 * MIN_LOT_PX) / TW), this.rawZoom));
    this.zoom = this.snapZoom(this.rawZoom);
    // keep the island on screen
    this.cx = Math.max(b.x, Math.min(b.x + b.w, this.cx));
    this.cy = Math.max(b.y, Math.min(b.y + b.h, this.cy));
    this.world.scale.set(this.zoom);
    const a = this.area();
    const res = this.app.renderer.resolution;
    // whole device pixels, so the art-pixel grid never straddles a screen pixel
    this.world.position.set(Math.round((a.x + a.w / 2 - this.cx * this.zoom) * res) / res, Math.round((a.y + a.h / 2 - this.cy * this.zoom) * res) / res);
    this.applyCamera();
  }
  /** Whole device pixels per art pixel (pixel-exact, no shimmer); only the far overview may go below 1:1. */
  private snapZoom(z: number): number {
    const per = this.app.renderer.resolution * this.art.u;
    const d = z * per;
    return d < 1 ? z : Math.round(d) / per;
  }
  /** The sea tiles follow the screen, anchored to world 0 so the pattern never swims when panning. */
  private applyCamera(): void {
    const z = this.zoom;
    const x = -this.world.x / z, y = -this.world.y / z;
    const w = this.app.screen.width / z + 2, h = this.app.screen.height / z + 2;
    for (const t of [this.seaTile, this.glintTile]) {
      if (!t) continue;
      t.position.set(x, y);
      t.width = w;
      t.height = h;
      t.tilePosition.set(-x + (t === this.glintTile ? this.glintShift : 0), -y);
    }
  }
  private glintShift = 0;
  zoomAt(sx: number, sy: number, k: number, fromDrawn = false): void {
    this.userCam = true;
    const wx = (sx - this.world.x) / this.zoom, wy = (sy - this.world.y) / this.zoom;
    this.rawZoom = (fromDrawn ? this.zoom : this.rawZoom) * k;
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
    this.dragFrom = { x: e.global.x, y: e.global.y, cx: this.cx, cy: this.cy, dist, zoom: this.rawZoom, moved: false };
  }
  private move(e: FederatedPointerEvent): void {
    if (!this.pointers.has(e.pointerId) || !this.dragFrom) return;
    this.pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
    const pts = [...this.pointers.values()];
    const d = this.dragFrom;
    if (pts.length > 1 && d.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
      this.zoomAt(mx, my, (d.zoom * (dist / d.dist)) / this.rawZoom);
      d.moved = true;
      return;
    }
    const dx = e.global.x - d.x, dy = e.global.y - d.y;
    if (Math.hypot(dx, dy) > 8) d.moved = true;
    if (d.moved) {
      this.userCam = true;
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
    const wx = (sx - this.world.x) / this.zoom;
    const wy = (sy - this.world.y) / this.zoom;
    if (!this.layout || !this.lastState) return null;
    const r = pickAt(wx, wy, this.lastState, this.layout);
    return r;
  }
  private lastState: IslandState | null = null;
  tap(sx: number, sy: number): void {
    const key = this.pick(sx, sy);
    if (key === "tent") return this.onTapTent();
    if (this.lotScreenWidth() < 34) {
      // too small to aim at: zoom toward the tap first (FINAL_PLAN_BT.md §6 tap-to-zoom)
      this.zoomAt(sx, sy, 48 / this.lotScreenWidth(), true);
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
    this.userCam = true;
    this.rawZoom = Math.max(this.zoom, 56 / TW);
    this.apply();
  }
  highlight(key: string | null): void {
    this.selectedKey = key;
    this.paintSelect();
  }
  /** Corner ticks on empty lots while the Build sheet is open (UI may call this). */
  setBuildOpen(open: boolean): void {
    this.buildOpen = open;
    this.paintSelect();
  }
  private selectedKey: string | null = null;
  private buildOpen = false;
  private lastLots: Record<string, unknown> | null = null;
  setLots(st: IslandState): void {
    this.lastLots = st.lots;
    this.paintSelect();
  }
  private paintSelect(): void {
    this.select.clear();
    const lots = this.lastLots;
    const key = this.selectedKey;
    if (!lots) return;
    for (const k of lotCornerKeys(lots, key, this.buildOpen)) {
      const [i, j] = kij(k);
      paintLotCorners(this.select, cellFront(i, j), k === key);
    }
    if (key && key in lots) {
      const [i, j] = kij(key);
      const f = cellFront(i, j);
      this.select.poly([f.x, f.y - TH, f.x + TW / 2, f.y - TH / 2, f.x, f.y, f.x - TW / 2, f.y - TH / 2]).stroke({ width: 3, color: 0xd9a441, alpha: 1 });
    }
  }

  // ---------- animation ----------
  tween(dur: number, step: (u: number) => void, done?: () => void): void {
    this.tweens.push({ t: 0, dur, step, done });
  }
  get busy(): boolean {
    return this.tweens.length > 0;
  }
  frozen = false;
  private update(dt: number): void {
    dt = Math.min(dt, 0.1);
    // tweens keep running while paused so dusk battle and seizure can play
    for (const tw of this.tweens.slice()) {
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur);
      tw.step(u);
      if (u >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.done?.();
      }
    }
    if (this.frozen || !this.layout) return;
    if (this.glide && !this.dragFrom) {
      const k = Math.min(1, dt * 6);
      const px = this.cx, py = this.cy;
      this.cx += (this.glide.x - this.cx) * k;
      this.cy += (this.glide.y - this.cy) * k;
      this.apply();
      // arrived, or held at the island's edge
      if (Math.hypot(this.glide.x - this.cx, this.glide.y - this.cy) < 0.5 || Math.hypot(this.cx - px, this.cy - py) < 0.05) this.glide = null;
    }
    this.clock += dt;
    this.stepWalkers(dt);
    this.stepWorldFx(dt);
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

  private stepWalkers(dt: number): void {
    const dusk = this.night || this.light > 0.88;
    const dawn = !this.night && this.wasNight;
    this.wasNight = this.night;
    for (const w of this.walkers) {
      if (dawn && !isWatch(w.job)) {
        const p = lotCentre(w.home);
        w.x = p.x;
        w.y = p.y;
        w.sp.alpha = 0;
        w.sp.visible = true;
        w.mode = "fadeIn";
        w.path = [];
      }
      if (dusk && !isWatch(w.job) && w.mode !== "toHome" && w.mode !== "fadeOut" && w.mode !== "gone") this.beginWalk(w, w.home);
      if (w.mode === "gone") {
        w.sp.visible = false;
        continue;
      }
      w.sp.visible = true;
      if ((w.mode === "toWork" || w.mode === "toHome") && !w.path.length) this.beginWalk(w, w.mode === "toHome" ? w.home : w.work);
      if (w.mode === "fadeIn") {
        w.sp.alpha = Math.min(1, w.sp.alpha + dt / 0.4);
        this.pose(w, "idle", dt, 2);
        if (w.sp.alpha >= 1) this.beginWalk(w, w.work);
      } else if (w.mode === "fadeOut") {
        w.sp.alpha = Math.max(0, w.sp.alpha - dt / 0.4);
        this.pose(w, "idle", dt, 2);
        if (w.sp.alpha <= 0) {
          w.mode = "gone";
          w.sp.visible = false;
        }
      } else if (w.mode === "work") {
        w.wait -= dt;
        this.pose(w, "work", dt, 4);
        if (w.wait <= 0) w.mode = "idle";
      } else if (w.mode === "idle") this.pose(w, "idle", dt, 2);
      else this.followPath(w, dt);
      w.sp.position.set(this.snap(w.x), this.snap(w.y));
      w.sp.zIndex = Math.round(((w.y - TH) / (TH / 2)) * 100) + 50;
    }
    for (const [id, sp] of this.sprites)
      if (id.startsWith("p/hesper")) sp.texture = this.personTex("hesper", "idle", "se", Math.floor(this.clock * 2) % 2);
  }
  private pose(w: Walker, anim: PersonAnim, dt: number, fps: number): void {
    w.phase += dt * fps;
    w.sp.texture = this.personTex(w.job, anim, w.view, Math.floor(w.phase) % (anim === "walk" ? 4 : 2));
    w.sp.scale.x = 1;
  }
  private followPath(w: Walker, dt: number): void {
    if (!w.path.length || w.pi >= w.path.length) {
      this.arrive(w);
      return;
    }
    const t = w.path[Math.min(w.pi, w.path.length - 1)];
    const dx = t.x - w.x, dy = t.y - w.y, d = Math.hypot(dx, dy);
    if (d < 1.2) {
      w.pi++;
      if (w.pi >= w.path.length) {
        this.arrive(w);
        return;
      }
    } else {
      const k = Math.min(1, (w.speed * dt) / d);
      w.x += dx * k;
      w.y += dy * k;
      w.view = facingOf(dx, dy);
    }
    this.pose(w, "walk", dt, 8);
  }
  private arrive(w: Walker): void {
    w.path = [];
    if (w.mode === "toWork") {
      w.mode = "work";
      w.wait = 2 + Math.random() * 2;
      const p = lotCentre(w.work);
      w.x = p.x;
      w.y = p.y;
    } else if (w.mode === "toHome") {
      const p = lotCentre(w.home);
      w.x = p.x;
      w.y = p.y;
      w.mode = this.night || this.light > 0.88 ? "fadeOut" : "idle";
    }
  }
  private clearFx(): void {
    for (const f of this.flags) f.sp.destroy();
    this.flags = [];
    for (const p of this.puffs) p.sp.destroy();
    this.puffs = [];
    this.hearths = [];
    this.swayers = [];
  }
  /** World position of a pixel anchor (chimney, flag pole) on a placed model. */
  private anchorOf(t: Placed, kind: "chimney" | "pole"): { x: number; y: number } | null {
    const base = t.frame.replace(/^grey\//, "");
    const a = this.art.anchor(base)?.[kind];
    if (!a) return null;
    const o = this.art.offset(t.frame, a);
    const k = t.scale ?? 1;
    return { x: t.x + o.x * k, y: t.y + o.y * k };
  }
  private syncFx(): void {
    this.hearths = [];
    for (const t of this.layout.things) {
      if (!t.frame.includes("/cottage/")) continue;
      this.hearths.push(this.anchorOf(t, "chimney") ?? { x: t.x - 6, y: t.y - 30 });
    }
    for (const f of this.flags) f.sp.destroy();
    this.flags = [];
    if (!this.art.has("fx/flag/0")) return;
    for (const t of this.layout.things) {
      if (!/\/tower\/|\/trade\/|\/lantern\/|^tent$/.test(t.frame.replace(/^grey\//, ""))) continue;
      const sp = new Sprite(this.art.get("fx/flag/0"));
      const at = this.anchorOf(t, "pole");
      const lift = t.frame.includes("tent") ? 40 : t.frame.includes("tower") ? 50 : 30;
      sp.position.set(at ? at.x : t.x + (t.frame.includes("trade") ? -12 : 6), at ? at.y : t.y - lift);
      sp.zIndex = t.z + 3;
      this.objects.addChild(sp);
      this.flags.push({ sp, ph: (t.x * 0.013) % 4 });
    }
  }
  private emitPuff(h: { x: number; y: number }): void {
    let p = this.puffs.find((q) => !q.on);
    if (!p) {
      if (this.puffs.length >= 24) return;
      const sp = new Sprite(this.art.get("fx/smoke/0"));
      sp.zIndex = 100000;
      this.objects.addChild(sp);
      p = { sp, life: 0, max: 1, vy: 0, x: 0, y: 0, on: false };
      this.puffs.push(p);
    }
    p.on = true;
    p.life = 0;
    p.max = 1.5 + this.rand() * 0.8;
    p.vy = 11 + this.rand() * 7;
    p.x = h.x;
    p.y = h.y;
    p.sp.visible = true;
  }
  private spawnCrest(c: Crest, initial: boolean): void {
    const b = this.layout.fitBounds;
    c.x = b.x + this.rand() * (b.w + 160);
    c.y = b.y + this.rand() * (b.h + 60);
    c.life = 5 + this.rand() * 3;
    c.age = initial ? this.rand() * c.life : 0;
    c.on = true;
    c.sp.visible = true;
  }
  /** Rough water belongs to the raid only: crests roll in while it plays, then drain away. */
  private setRaid(on: boolean): void {
    this.raidOn = on;
    if (on) for (const c of this.crests) this.spawnCrest(c, true);
    this.stepSea(true);
  }
  get rough(): boolean {
    return this.raidOn;
  }
  private stepSea(force: boolean): void {
    if (!this.seaTile) return;
    const state = seaState(this.raidOn);
    const sps = seaStepsPerSecond(this.amb, state);
    const step = sps === 0 ? 0 : Math.floor(this.clock * sps);
    const key = step * 2 + (state === "rough" ? 1 : 0);
    if (!force && key === this.seaStep) return;
    this.seaStep = key;
    const list = state === "rough" ? this.art.rough : this.art.calm;
    this.seaTile.texture = list[step % list.length];
    if (this.glintTile) {
      this.glintShift = (step % 8) * 4 * this.art.u;
      this.applyCamera();
    }
  }
  /** Rows near the roof lean one art pixel and back; the base stays put. Writes the vertex buffer in place. */
  private swayMeshes(): void {
    const u = this.art.u;
    for (let i = 0; i < this.meshes.length; i++) {
      const { mesh, ph } = this.meshes[i];
      if (mesh.destroyed) continue;
      const geo = mesh.geometry as PlaneGeometry;
      const pos = geo.positions;
      const rows = 6, w = geo.width, h = geo.height;
      for (let r = 0; r < rows; r++) {
        const k = 1 - r / (rows - 1);
        const dx = Math.round((Math.sin(this.clock * 1.7 + ph + r * 0.5) * 1.4 * k * k) ) * u;
        pos[(r * 2) * 2] = dx;
        pos[(r * 2) * 2 + 1] = (r * h) / (rows - 1);
        pos[(r * 2 + 1) * 2] = w + dx;
        pos[(r * 2 + 1) * 2 + 1] = (r * h) / (rows - 1);
      }
      geo.getBuffer("aPosition").update();
    }
  }
  private fxTick = -1;
  private gullOut: GullPoseT = { x: 0, y: 0, vx: 0, vy: 0, flipX: false, frame: 0 };
  private stepWorldFx(dt: number): void {
    this.stepSea(false);
    const tick = Math.floor(this.clock * 12);
    const stepped = tick !== this.fxTick;
    this.fxTick = tick;
    for (const b of this.boats) {
      if (!this.boatBase.has(b)) this.boatBase.set(b, b.y);
      b.y = this.snap(this.boatBase.get(b)! + Math.sin(this.clock * 2.2 + b.x * 0.05) * 1.7);
    }
    const flagTex = this.flagTex, smokeTex = this.smokeTex;
    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      f.ph += dt * 6;
      f.sp.texture = flagTex[Math.floor(f.ph) % flagTex.length];
    }
    this.emitT += dt;
    if (this.emitT > 0.38) {
      this.emitT = 0;
      for (let i = 0; i < this.hearths.length; i++) this.emitPuff(this.hearths[i]);
    }
    for (let i = 0; i < this.puffs.length; i++) {
      const s = this.puffs[i];
      if (!s.on) continue;
      s.life += dt;
      if (s.life >= s.max) {
        s.on = false;
        s.sp.visible = false;
        continue;
      }
      const u = s.life / s.max;
      s.sp.texture = smokeTex[Math.min(smokeTex.length - 1, Math.floor(u * smokeTex.length))];
      s.sp.position.set(this.snap(s.x + Math.sin(s.life * 2.4) * 6), this.snap(s.y - s.vy * s.life));
      s.sp.alpha = u < 0.5 ? 0.9 : u < 0.8 ? 0.6 : 0.35;
    }
    if (!stepped) return;
    const amb = this.amb;
    if (amb.sway) {
      for (let i = 0; i < this.tufts.length; i++) {
        const t = this.tufts[i];
        t.sp.texture = this.grassTex[t.g][(tick / 4 + t.ph) % 3 | 0];
      }
      for (let i = 0; i < this.swayers.length; i++) {
        const w = this.swayers[i];
        w.sp.texture = w.frames[(((tick / 5) | 0) + w.ph) % 3];
      }
    }
    const b = this.layout.fitBounds;
    for (let i = 0; i < this.crests.length; i++) {
      const c = this.crests[i];
      if (!c.on) continue;
      c.age += 1 / 12;
      if (c.age >= c.life) {
        if (this.raidOn) this.spawnCrest(c, false);
        else {
          c.on = false;
          c.sp.visible = false;
          continue;
        }
      }
      c.sp.position.set(this.snap(c.x + WAVE_DIR.x * 20 * c.age), this.snap(c.y + WAVE_DIR.y * 20 * c.age));
      c.sp.alpha = crestAlpha(c.age / c.life, this.raidOn);
    }
    if (amb.mesh) this.swayMeshes();
    for (let i = 0; i < this.gulls.length; i++) {
      const g = this.gulls[i];
      const p = gullPose(g.spec, this.clock, b.x, b.w, this.gullOut);
      g.sp.position.set(this.snap(p.x), this.snap(p.y));
      g.sp.scale.x = p.flipX ? -1 : 1;
      g.sp.texture = this.gullTex[p.frame];
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.x += c.v / 12;
      if (c.x < b.x - 120) c.x = b.x + b.w + 40;
      c.sp.position.set(this.snap(c.x), this.snap(c.y));
    }
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
    this.setRaid(true);
    try {
      await this.playRaidBeats(res);
    } finally {
      this.setRaid(false);
    }
  }
  private async playRaidBeats(res: RaidResult): Promise<void> {
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
    const ring: Piece[] = [];
    const towers: Piece[] = [];
    for (const [id, sp] of this.sprites) {
      if (id.includes("ring/") || id.includes("gate/")) ring.push(sp);
      if (id.includes("tower") || id.includes("watch")) towers.push(sp);
    }
    const shadow = res.boss && this.art.has("fx/monster/0/0") ? this.spawnMonster(res.S) : null;
    const restoreCam = shadow ? this.frameShadow(shadow.height) : null;
    const arrows: Sprite[] = [];
    const towerY = towers.map((s) => s.y);
    const ringX = ring.map((s) => s.x);
    let curPhase: BattlePhase = "approach";
    const wait = (dur: number, step: (u: number) => void) => {
      const run = (u: number): void => {
        step(u);
        if (!shadow) return;
        shadow.pose(monsterPose(curPhase, u, res.won));
        if (curPhase === "defend" || curPhase === "clash") shadow.volley(arrows, towers, defenders, u, arrowCount(res.S, res.D, 8));
      };
      return dur <= 0 ? Promise.resolve(run(1)) : new Promise<void>((done) => this.tween(dur, run, done));
    };

    try {
      for (const beat of battleTimeline(res, reduced)) {
        curPhase = beat.phase;
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
              d.texture = this.personTex("watch", "walk", "se", Math.floor(u * 6) % 4);
              d.scale.x = 1;
            });
          });
          ring.forEach((s) => (s.alpha = 1));
          towers.forEach((s, k) => (s.y = towerY[k]!));
        } else if (beat.phase === "clash") {
          const sparks: Sprite[] = [];
          await wait(beat.dur, (u) => {
            raiders.forEach((r, k) => {
              r.position.set(g.x + 90 - 70 * u + (k % 4) * 10, g.y + 48 - 32 * u + Math.floor(k / 4) * 8);
              r.texture = this.personTex("raider", "walk", "nw", Math.floor(u * 10) % 4);
              r.scale.x = 1;
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
                r.texture = this.personTex("raider", "walk", "nw", Math.floor(u * 8 + k) % 4);
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
          boats.forEach((b, k) => {
            if (k > 0 || !res.won) b.destroy();
            else {
              this.boatBase.set(b, b.y);
              this.boats.push(b);
            }
          });
          while (this.boats.length > 3) {
            const gone = this.boats.shift()!;
            this.boatBase.delete(gone);
            gone.destroy();
          }
        }
      }
    } finally {
      shadow?.destroy();
      arrows.forEach((a) => a.destroy());
      restoreCam?.();
    }
  }


  /** The Long Dusk (day 6): a hooded shadow behind the island, sized by the raid's strength. */
  private spawnMonster(S: number): {
    height: number;
    pose: (p: MonsterPose) => void;
    volley: (arrows: Sprite[], towers: Piece[], defenders: Sprite[], u: number, count: number) => void;
    destroy: () => void;
  } {
    const size = monsterSize(S);
    const b = this.layout.bounds;
    const u = this.art.u;
    const baseX = b.x + b.w / 2;
    // the waterline sits just inside the back corner of the island, so the lower hem melts into the shallows
    const baseY = b.y + SHADOW_BASE;
    const height = monsterHeight(size, u);
    const sp = new Sprite(this.art.get(`fx/monster/${size}/0`));
    const mask = new Graphics();
    sp.mask = mask;
    this.sea.addChild(mask, sp);
    let lean = 0;
    const place = (p: MonsterPose): void => {
      sp.visible = p.rise > 0.01;
      sp.alpha = p.alpha;
      sp.texture = this.art.get(`fx/monster/${size}/${monsterFrame(this.clock)}`);
      lean = p.lean * u;
      sp.position.set(this.snap(baseX + lean), this.snap(baseY + (1 - p.rise) * height * 0.95));
      // everything below the waterline is hidden: it is rising out of the sea, not sliding over the island
      mask.clear().rect(baseX - height * 2, baseY - height * 2, height * 4, height * 2 + 4).fill(0xffffff);
    };
    place({ rise: 0, alpha: 1, lean: 0 });
    return {
      height,
      pose: place,
      volley: (arrows, towers, defenders, k, count) => {
        const from = [...towers.map((t) => ({ x: t.x, y: t.y - 36 })), ...defenders.map((d) => ({ x: d.x, y: d.y - 14 }))];
        if (!from.length) return;
        const target = { x: baseX + lean, y: baseY - height * 0.45 };
        const want = Math.floor(k * count);
        while (arrows.length < want) {
          const a = new Sprite(this.art.get("fx/arrow"));
          a.zIndex = 100000;
          a.alpha = 0;
          this.objects.addChild(a);
          (a as Sprite & { _from?: { x: number; y: number }; _t0?: number })._from = from[arrows.length % from.length];
          (a as Sprite & { _t0?: number })._t0 = k;
          arrows.push(a);
        }
        arrows.forEach((a, n) => {
          const m = a as Sprite & { _from: { x: number; y: number }; _t0: number };
          const t = Math.max(0, Math.min(1, (k - m._t0) / 0.35));
          const lift = Math.sin(t * Math.PI) * 26;
          a.alpha = t > 0 && t < 1 ? 1 : 0;
          a.scale.x = target.x < m._from.x ? -1 : 1;
          a.position.set(this.snap(m._from.x + (target.x - m._from.x) * t), this.snap(m._from.y + (target.y - m._from.y) * t - lift + n * 0));
        });
      },
      destroy: () => {
        sp.mask = null;
        mask.destroy();
        sp.destroy();
      },
    };
  }

  /** Show the whole shadow: zoom and centre so the island, the sea behind it and the monster's head all fit. Returns the undo. */
  private frameShadow(height: number): () => void {
    const saved = { cx: this.cx, cy: this.cy, raw: this.rawZoom, user: this.userCam, fit: this.fitZoom };
    const land = this.layout.bounds;
    const top = land.y + SHADOW_BASE - height - 12;
    // the shadow is the show: frame it and the back of the island; the near shore may fall off the bottom of the screen
    const box = { x: land.x + land.w * 0.05, y: top, w: land.w * 0.9, h: land.y + SHADOW_BASE + land.h * 0.78 - top };
    const a = this.area();
    const z = Math.min(a.w / box.w, a.h / box.h);
    const per = this.app.renderer.resolution * this.art.u;
    this.userCam = true;
    this.glide = null;
    const want = z * per >= 1 ? Math.floor(z * per) / per : z;
    this.fitZoom = Math.min(this.fitZoom, want);
    this.rawZoom = want;
    this.cx = box.x + box.w / 2;
    this.cy = box.y + box.h / 2;
    this.apply();
    return () => {
      this.fitZoom = saved.fit;
      this.userCam = saved.user;
      this.rawZoom = saved.raw;
      this.cx = saved.cx;
      this.cy = saved.cy;
      this.apply();
      if (!saved.user) this.fit(false);
    };
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
    const px = this.art.thumb(frame);
    if (px) {
      this.thumbs.set(frame, px);
      return px;
    }
    const f = this.atlas?.frames.get(frame);
    if (!f) return "";
    const c = document.createElement("canvas");
    c.width = f.w;
    c.height = f.h;
    c.getContext("2d")!.drawImage(this.atlas!.pages[f.page], f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    url = c.toDataURL();
    this.thumbs.set(frame, url);
    return url;
  }
  get currentEra(): string {
    return this.era;
  }

  stats(): { sprites: number; walkers: number; zoom: number; fitZoom: number; sea: string; gulls: number; crests: number; tier: string } {
    return {
      sprites: this.objects.children.length + this.ground.children.length + this.shore.children.length,
      walkers: this.walkers.length,
      zoom: this.zoom,
      fitZoom: this.fitZoom,
      sea: seaState(this.raidOn),
      gulls: this.gulls.length,
      crests: this.crests.filter((c) => c.on).length,
      tier: this.cfg.tier,
    };
  }
}

const ease = (u: number): number => 1 - (1 - u) * (1 - u);
function mix(a: number, b: number, u: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * u);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
function toward(from: { x: number; y: number }, to: { x: number; y: number }, d: number): { x: number; y: number } {
  const dx = to.x - from.x, dy = to.y - from.y, m = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / m) * d, y: from.y + (dy / m) * d };
}
function paintLotCorners(g: Graphics, f: { x: number; y: number }, selected: boolean): void {
  const diamond = [
    { x: f.x, y: f.y - TH },
    { x: f.x + TW / 2, y: f.y - TH / 2 },
    { x: f.x, y: f.y },
    { x: f.x - TW / 2, y: f.y - TH / 2 },
  ];
  const len = 6;
  for (let i = 0; i < 4; i++) {
    const c = diamond[i];
    const a = toward(c, diamond[(i + 3) % 4], len);
    const b = toward(c, diamond[(i + 1) % 4], len);
    g.moveTo(a.x, a.y).lineTo(c.x, c.y).lineTo(b.x, b.y);
  }
  g.stroke({ width: selected ? 2 : 1.4, color: selected ? 0xd9a441 : 0x3d3428, alpha: selected ? 0.95 : 0.55, cap: "round", join: "round" });
}
