/**
 * The Phase 0 stress scene renderer (FINAL_PLAN_BT.md §5). No game logic: it draws the City-tier
 * worst case from the pure sim data and measures how the device copes.
 *
 * Draw-call discipline: every sprite comes from a few atlases with normal blending, so the batcher
 * merges each layer into a handful of calls; the static ground is baked into a render texture;
 * off-screen sprites are culled; glows, fire and smoke are ParticleContainers.
 */
import { KawaseBlurFilter } from "pixi-filters";
import { Application, Container, Matrix, Particle, ParticleContainer, Rectangle, RenderTexture, Sprite, Texture, TilingSprite, type Filter } from "pixi.js";
import { cameraAt, fitZoom, type CameraState, type Shot } from "../sim/camera";
import { buildingFrameName, footprintForLook, type BuildingType } from "../sim/catalog";
import { buildCity, CITY_SIZE, inside, isGreyLot, OUTSKIRTS, PLAZA, worldBounds, type Building, type City } from "../sim/city";
import { cycleAt, gnomonAngle, lightAt, phaseAt, type DayPhase } from "../sim/daycycle";
import { project } from "../sim/iso";
import { KIND_ARROW, KIND_FIRE, KIND_SMOKE, KIND_SPARK, ParticlePool } from "../sim/particles";
import { buildPeople, raiderPose, villagerPose, type FigurePose, type People } from "../sim/people";
import { Rng } from "../sim/rng";
import { loadAtlases, type LoadedAtlases } from "./atlases";
import type { Scenario, TierConfig } from "./config";
import { createGreyFilter } from "./greyFilter";

const LOOP_PERIOD_S = 120;
const CINEMATIC_S = 6;

interface Culled {
  view: Container;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Puppet {
  root: Container;
  parts: Sprite[]; // legs, torso, armL, armR, head, prop
  baked?: Sprite;
  bakedFrames?: Texture[];
  grey: boolean;
}

export interface FrameInfo {
  phase: DayPhase;
  raid: boolean;
  cinematic: boolean;
  settled: boolean;
  zoom: number;
  visibleSprites: number;
  particles: number;
  rebaked: boolean;
}

export class StressScene {
  readonly app: Application;
  readonly cfg: TierConfig;
  readonly scenario: Scenario;
  readonly city: City;
  readonly people: People;
  private atlases!: LoadedAtlases;
  private readonly root = new Container({ label: "root" });
  private readonly world = new Container({ label: "world" });
  private readonly worldFx = new Container({ label: "worldFx" });
  private readonly colour = new Container({ label: "colour", sortableChildren: true });
  private readonly grey = new Container({ label: "grey", sortableChildren: true });
  private readonly seaFront = new Container({ label: "sea" });
  private readonly ground = new Container({ label: "ground" });
  private tint!: Sprite;
  private grain!: TilingSprite;
  private vignette!: Sprite;
  private fullBake!: RenderTexture;
  private fullBakeSprite!: Sprite;
  private viewBake!: RenderTexture;
  private viewBakeSprite!: Sprite;
  private bakeKey = { zoom: 0, x0: 0, y0: 0, x1: 0, y1: 0 };
  private glows!: ParticleContainer;
  private fxAdd!: ParticleContainer;
  private fxNormal!: ParticleContainer;
  private addParticles: Particle[] = [];
  private normalParticles: Particle[] = [];
  private pool: ParticlePool;
  private ring!: Sprite;
  private bloomRT?: RenderTexture;
  private bloomSprite?: Sprite;
  private gnomonShadow!: Sprite;
  private readonly culled: Culled[] = [];
  private readonly buildingSprites: { b: Building; sprite: Sprite; city: Texture; town: Texture }[] = [];
  private readonly villagers: Puppet[] = [];
  private readonly raiders: Puppet[] = [];
  private crowd: { sprite: Sprite; baseX: number; baseY: number; phase: number; frames: Texture[] }[] = [];
  private boats: Sprite[] = [];
  private fires: { x: number; y: number }[] = [];
  private towers: { x: number; y: number }[] = [];
  private shots: Shot[] = [];
  private greyFilter!: Filter;
  private readonly rng = new Rng(99);
  private readonly pose: FigurePose = { x: 0, y: 0, visible: false, walking: false, facing: 1, beat: 0 };
  private elapsedS = 0;
  private lastCinematicS = -999;
  private resolution = 1;
  readonly worldRect = worldBounds();

  constructor(app: Application, cfg: TierConfig, scenario: Scenario) {
    this.app = app;
    this.cfg = cfg;
    this.scenario = scenario;
    this.city = buildCity(scenario.seed);
    this.people = buildPeople(this.city, {
      villagers: cfg.villagers,
      raiders: cfg.raiders,
      clusters: scenario.crowd ? 48 : 0,
      perCluster: 33,
    });
    this.pool = new ParticlePool(cfg.particles);
  }

  async load(): Promise<void> {
    this.atlases = await loadAtlases(this.cfg.atlas);
    this.resolution = this.app.renderer.resolution;
    this.greyFilter = createGreyFilter(this.resolution);
    this.grey.filters = [this.greyFilter];
    this.buildGround();
    this.buildBuildings();
    this.buildPeople();
    this.buildFx();
    this.buildScreenLayers();
    this.app.stage.addChild(this.root, this.grain, this.vignette);
    this.root.addChild(this.world, this.tint, this.worldFx);
    this.world.addChild(this.fullBakeSprite, this.viewBakeSprite, this.colour, this.grey, this.seaFront);
    if (this.cfg.bloom) {
      // Bloom on the emissive layer only (windows, torches, fire, sparks): ART_BIBLE.md forbids
      // blanket bloom. The chain runs at half resolution and is added over the scene.
      this.bloomRT = RenderTexture.create({ width: 16, height: 16, resolution: 1 });
      this.bloomSprite = new Sprite(this.bloomRT);
      this.bloomSprite.blendMode = "add";
      const blur = new KawaseBlurFilter({ strength: 6, quality: 3 });
      blur.resolution = this.cfg.bloomResolution;
      this.bloomSprite.filters = [blur];
      this.app.stage.addChildAt(this.bloomSprite, 1);
    }
    this.resize();
    this.bakeFull();
  }

  private tex(name: string): Texture {
    const t = this.atlases.textures.get(name);
    if (!t) throw new Error(`missing stand-in frame ${name}`);
    return t;
  }

  private addCulled(view: Container, parent: Container): void {
    parent.addChild(view);
    const b = view.getLocalBounds();
    this.culled.push({ view, x0: view.x + b.minX, y0: view.y + b.minY, x1: view.x + b.maxX, y1: view.y + b.maxY });
  }

  private buildGround(): void {
    const lo = -1 - OUTSKIRTS - 2, hi = CITY_SIZE + OUTSKIRTS + 2;
    const greyGround = new Container();
    greyGround.filters = [createGreyFilter(1)];
    const colourGround = new Container();
    for (let j = lo; j <= hi; j++)
      for (let i = lo; i <= hi; i++) {
        const ring = Math.max(-1 - i, -1 - j, i - CITY_SIZE, j - CITY_SIZE);
        let kind = `grass${(i * 7 + j * 3) & 3}`;
        if (ring >= OUTSKIRTS + 1) kind = ring >= OUTSKIRTS + 2 ? "" : "shore";
        else if (inside(i, j)) {
          const use = this.city.lotUse[j * CITY_SIZE + i];
          kind = use === "road" ? "road" : use === "plaza" ? "plaza" : "lot";
        } else if ([4, 10, 16].includes(i) || [4, 10, 16].includes(j)) kind = "road";
        if (!kind) continue;
        const s = new Sprite(this.tex(`ground/${kind}`));
        const p = project(i + 1, j + 1);
        s.position.set(p.x, p.y);
        (inside(i, j) && isGreyLot(this.city, i, j) ? greyGround : colourGround).addChild(s);
      }
    this.ground.addChild(colourGround, greyGround);
    for (const pr of this.city.props) {
      const s = new Sprite(this.tex(`prop/${pr.kind}`));
      s.position.set(pr.anchor.x, pr.anchor.y);
      this.ground.addChild(s);
    }
    for (const w of this.city.walls.filter((x) => x.back).sort((a, b) => a.depth - b.depth)) {
      const s = new Sprite(this.tex(`wall/${w.stage}/${w.piece}`));
      s.position.set(w.anchor.x, w.anchor.y);
      this.ground.addChild(s);
    }
    this.fullBake = RenderTexture.create({ width: this.cfg.atlas === "low" ? 1024 : 1536, height: this.cfg.atlas === "low" ? 640 : 960, resolution: 1 });
    this.fullBakeSprite = new Sprite(this.fullBake);
    this.viewBake = RenderTexture.create({ width: 16, height: 16, resolution: 1 });
    this.viewBakeSprite = new Sprite(this.viewBake);
  }

  private buildBuildings(): void {
    for (const b of this.city.buildings) {
      const cityName = b.block ? `city/block/${b.look}` : buildingFrameName("city", b.type, b.look);
      const tl = Math.min(5, b.look);
      const townType: BuildingType = ["exchange", "harbour", "observatory"].includes(b.type) ? "academy" : b.type;
      let townName = b.block ? `town/block/${b.look}` : buildingFrameName("town", townType, tl);
      if (footprintForLook(tl) !== b.n) townName = cityName; // the 3x3 grand look has no Town drawing
      const cityTex = this.tex(cityName), townTex = this.tex(townName);
      const s = new Sprite(cityTex);
      s.position.set(b.anchor.x, b.anchor.y);
      s.zIndex = b.depth;
      this.addCulled(s, b.grey ? this.grey : this.colour);
      this.buildingSprites.push({ b, sprite: s, city: cityTex, town: townTex });
      if (b.fire) this.fires.push({ x: b.anchor.x, y: b.anchor.y - 70 - b.n * 30 });
      if (b.type === "watchtower" && b.i + b.j > 26) this.towers.push({ x: b.anchor.x, y: b.anchor.y - 120 });
    }
    for (const w of this.city.walls.filter((x) => !x.back)) {
      const s = new Sprite(this.tex(`wall/${w.stage}/${w.piece}`));
      s.position.set(w.anchor.x, w.anchor.y);
      s.zIndex = w.depth;
      this.addCulled(s, this.grey);
    }
    const tent = new Sprite(this.tex("tent"));
    tent.position.set(this.city.tent.anchor.x, this.city.tent.anchor.y);
    tent.zIndex = this.city.tent.depth;
    this.addCulled(tent, this.colour);
    const g = this.city.gnomon;
    this.gnomonShadow = new Sprite(this.tex("gnomonShadow"));
    this.gnomonShadow.position.set(g.anchor.x, g.anchor.y);
    this.gnomonShadow.zIndex = g.depth - 1;
    this.colour.addChild(this.gnomonShadow);
    const gn = new Sprite(this.tex("gnomon"));
    const ga = project(PLAZA.i + 2, PLAZA.j + 2);
    gn.position.set(ga.x, ga.y + 16);
    gn.zIndex = g.depth;
    this.addCulled(gn, this.colour);
    for (const boat of this.city.boats.slice(0, this.cfg.boats)) {
      const s = new Sprite(this.tex("boat"));
      s.position.set(boat.home.x, boat.home.y);
      this.seaFront.addChild(s);
      this.boats.push(s);
    }
  }

  private makePuppet(costume: string, parent: Container): Puppet {
    const root = new Container();
    const p: Puppet = { root, parts: [], grey: parent === this.grey };
    if (this.cfg.puppets) {
      const lay: [string, number, number][] = [["legs", 0, -16], ["torso", 0, -18], ["armL", -9, -32], ["armR", 9, -32], ["head", 0, -34], ["prop", 13, -22]];
      for (const [part, x, y] of lay) {
        const s = new Sprite(this.tex(`part/${costume}/${part}`));
        s.position.set(x, y);
        root.addChild(s);
        p.parts.push(s);
      }
    } else {
      p.bakedFrames = [this.tex(`baked/${costume}/0`), this.tex(`baked/${costume}/1`)];
      p.baked = new Sprite(p.bakedFrames[0]);
      root.addChild(p.baked);
    }
    parent.addChild(root);
    return p;
  }

  private buildPeople(): void {
    for (const v of this.people.villagers) {
      const end = v.path[v.path.length - 1];
      const lot = { i: Math.floor((end.y / 32 + end.x / 64) / 2), j: Math.floor((end.y / 32 - end.x / 64) / 2) };
      this.villagers.push(this.makePuppet(v.job, isGreyLot(this.city, lot.i, lot.j) ? this.grey : this.colour));
    }
    for (let k = 0; k < this.people.raiders.length; k++) this.raiders.push(this.makePuppet("raider", this.grey));
    const kinds = ["field", "clockworks", "trade", "watch"];
    for (const c of this.people.clusters) {
      const parent = isGreyLot(this.city, c.i, c.j) ? this.grey : this.colour;
      for (const f of c.figures) {
        const frames = [this.tex(`baked/${kinds[f.kind]}/0`), this.tex(`baked/${kinds[f.kind]}/1`)];
        const s = new Sprite(frames[0]);
        s.position.set(f.base.x, f.base.y);
        s.zIndex = (f.base.y / 32 - 1) * 1000 + 500;
        parent.addChild(s);
        this.crowd.push({ sprite: s, baseX: f.base.x, baseY: f.base.y, phase: f.phase, frames });
      }
    }
  }

  private buildFx(): void {
    const glowTex = this.tex("fx/window");
    this.glows = new ParticleContainer({ texture: glowTex, dynamicProperties: { position: false, vertex: false, rotation: false, uvs: false, color: false } });
    this.glows.blendMode = "add";
    for (const { b } of this.buildingSprites) {
      const count = b.type === "field" ? 0 : b.n + 1;
      for (let k = 0; k < count; k++) {
        const x = b.anchor.x + (k - count / 2) * 22 * b.n + this.rng.range(-6, 6);
        const y = b.anchor.y - 30 - this.rng.range(0, 30 + b.look * 8) * b.n;
        this.glows.addParticle(new Particle({ texture: glowTex, x, y, anchorX: 0.5, anchorY: 0.5, scaleX: 1.2, scaleY: 1.2, tint: 0xffffff }));
      }
    }
    for (const w of this.city.walls) this.glows.addParticle(new Particle({ texture: this.tex("fx/glow"), x: w.anchor.x, y: w.anchor.y - 80, anchorX: 0.5, anchorY: 0.5, scaleX: 0.3, scaleY: 0.3 }));
    const dyn = { position: true, vertex: true, rotation: true, uvs: true, color: true };
    const fire = this.tex("fx/fire/0");
    this.fxAdd = new ParticleContainer({ texture: fire, dynamicProperties: dyn });
    this.fxAdd.blendMode = "add";
    this.fxNormal = new ParticleContainer({ texture: fire, dynamicProperties: dyn });
    for (let k = 0; k < this.cfg.particles; k++) {
      const a = new Particle({ texture: fire, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
      const n = new Particle({ texture: fire, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
      this.fxAdd.addParticle(a);
      this.fxNormal.addParticle(n);
      this.addParticles.push(a);
      this.normalParticles.push(n);
    }
    this.ring = new Sprite(this.tex("fx/ring"));
    this.ring.blendMode = "add";
    this.ring.visible = false;
    this.worldFx.addChild(this.glows, this.fxNormal, this.fxAdd, this.ring);
  }

  private buildScreenLayers(): void {
    this.tint = new Sprite(Texture.WHITE);
    this.tint.blendMode = "multiply";
    // Paper grain: one static screen-space overlay, multiply (ART_BIBLE.md §6).
    this.grain = new TilingSprite({ texture: this.atlases.grain, width: 16, height: 16 });
    this.grain.blendMode = "multiply";
    this.grain.alpha = 0.7;
    this.vignette = new Sprite(this.tex("fx/vignette"));
  }

  resize(): void {
    const { width, height } = this.app.screen;
    this.tint.setSize(width, height);
    this.grain.setSize(width, height);
    this.vignette.setSize(width, height);
    const c = project(CITY_SIZE / 2, CITY_SIZE / 2);
    this.shots = [
      { x: c.x, y: c.y - 120, zoom: 1 },
      { x: c.x, y: c.y - 40, zoom: 4.2 },
      ...this.fires.slice(0, 2).map((f) => ({ x: f.x, y: f.y, zoom: 3.4 })),
      { x: project(CITY_SIZE + 2, 10).x, y: project(CITY_SIZE + 2, 10).y, zoom: 2.4 },
      { x: project(3, 3).x, y: project(3, 3).y - 60, zoom: 3 },
      { x: c.x, y: c.y + 300, zoom: 1.6 },
    ];
    const w = Math.ceil(width * this.resolution * 1.5), h = Math.ceil(height * this.resolution * 1.5);
    this.viewBake.resize(w, h);
    if (this.bloomRT && this.bloomSprite) {
      const k = this.resolution * this.cfg.bloomResolution;
      this.bloomRT.resize(Math.ceil(width * k), Math.ceil(height * k));
      this.bloomSprite.scale.set(1 / k);
      this.bloomSprite.filterArea = new Rectangle(0, 0, width * k, height * k);
    }
    this.bakeKey.zoom = 0;
  }

  /** City fit zoom: the walled 21x21 diamond fills the screen width with a little margin. */
  fit(): number {
    return fitZoom(this.app.screen.width, CITY_SIZE * 128 * 1.18);
  }

  private bakeFull(): void {
    const r = this.worldRect;
    const s = Math.min(this.fullBake.width / r.w, this.fullBake.height / r.h);
    const m = new Matrix().translate(-r.x, -r.y).scale(s, s);
    this.app.renderer.render({ container: this.ground, target: this.fullBake, clear: true, transform: m });
    this.fullBakeSprite.position.set(r.x, r.y);
    this.fullBakeSprite.scale.set(1 / s);
  }

  /** Bakes the static ground for the settled view (plus a 25% margin) at screen resolution. */
  private bakeView(cam: CameraState): void {
    const { width, height } = this.app.screen;
    const k = cam.zoom * this.resolution;
    const x0 = cam.x - (width * 0.75) / cam.zoom, y0 = cam.y - (height * 0.75) / cam.zoom;
    const m = new Matrix().translate(-x0, -y0).scale(k, k);
    this.app.renderer.render({ container: this.ground, target: this.viewBake, clear: true, transform: m });
    this.viewBakeSprite.position.set(x0, y0);
    this.viewBakeSprite.scale.set(1 / k);
    this.bakeKey = { zoom: cam.zoom, x0, y0, x1: x0 + (width * 1.5) / cam.zoom, y1: y0 + (height * 1.5) / cam.zoom };
  }

  private camera(): CameraState {
    const worst = this.scenario.mode !== "loop";
    return cameraAt(this.elapsedS, this.shots, worst ? 1.6 : 2.5, worst ? 1.4 : 4, this.fit());
  }

  /** Advance and draw one frame. dtS is real seconds since the last frame (clamped). */
  update(dtS: number): FrameInfo {
    const dt = Math.min(0.1, Math.max(0, dtS));
    this.elapsedS += dt;
    const worst = this.scenario.mode !== "loop";
    const t = worst ? 1.6 : cycleAt(this.elapsedS, LOOP_PERIOD_S);
    const phase = phaseAt(t);
    const light = lightAt(t);
    const raidR = worst ? (this.elapsedS % 20) / 14 : t > 1.15 && t < 1.95 ? (t - 1.15) / 0.3 : 0;
    const raid = raidR > 0;

    // Camera.
    const cam = this.camera();
    const { width, height } = this.app.screen;
    for (const layer of [this.world, this.worldFx]) {
      layer.scale.set(cam.zoom);
      layer.position.set(width / 2 - cam.x * cam.zoom, height / 2 - cam.y * cam.zoom);
    }
    const vx0 = cam.x - width / 2 / cam.zoom, vy0 = cam.y - height / 2 / cam.zoom;
    const vx1 = cam.x + width / 2 / cam.zoom, vy1 = cam.y + height / 2 / cam.zoom;
    let rebaked = false;
    const bk = this.bakeKey;
    const covered = bk.zoom > 0 && vx0 >= bk.x0 && vy0 >= bk.y0 && vx1 <= bk.x1 && vy1 <= bk.y1;
    if (cam.settled && (Math.abs(cam.zoom - bk.zoom) > bk.zoom * 0.02 || !covered)) {
      this.bakeView(cam);
      rebaked = true;
    }

    // Light: background sea, full-screen multiply tint, window glows by night.
    this.app.renderer.background.color = light.sea;
    this.tint.tint = light.tint;
    this.tint.alpha = light.tintAlpha;
    this.glows.alpha = Math.max(light.night, raid ? 0.6 : 0) * 0.9;
    this.gnomonShadow.rotation = gnomonAngle(t);
    this.gnomonShadow.alpha = 1 - light.night;

    // Cull.
    const m = 160;
    let visible = 0;
    for (const c of this.culled) {
      const on = c.x1 > vx0 - m && c.x0 < vx1 + m && c.y1 > vy0 - m && c.y0 < vy1 + m;
      c.view.visible = on;
      if (on) visible++;
    }
    this.grey.filterArea = new Rectangle(vx0, vy0, vx1 - vx0, vy1 - vy0);
    const inView = (x: number, y: number) => x > vx0 - 40 && x < vx1 + 40 && y > vy0 - 10 && y < vy1 + 80;

    // Era transformation cinematic: Town -> City wash from the plaza.
    const every = worst ? 30 : 75;
    if (this.elapsedS - this.lastCinematicS > every && this.elapsedS > 8) this.lastCinematicS = this.elapsedS;
    const ce = this.elapsedS - this.lastCinematicS;
    const cinematic = ce < CINEMATIC_S;
    const centre = project(CITY_SIZE / 2, CITY_SIZE / 2);
    const radius = cinematic ? (ce / CINEMATIC_S) * 2200 : Infinity;
    for (const bs of this.buildingSprites) {
      const d = Math.hypot((bs.b.anchor.x - centre.x) / 2, bs.b.anchor.y - centre.y);
      bs.sprite.texture = d < radius ? bs.city : bs.town;
    }
    this.ring.visible = cinematic;
    if (cinematic) {
      this.ring.position.set(centre.x - radius * 2, centre.y - radius);
      this.ring.width = radius * 4;
      this.ring.height = radius * 2;
      this.ring.alpha = 1 - ce / CINEMATIC_S;
    }

    // People.
    let figures = 0;
    this.people.villagers.forEach((v, k) => {
      const p = villagerPose(v, t, phase, raid, this.pose);
      const pup = this.villagers[k];
      figures += this.placePuppet(pup, p, inView(p.x, p.y));
    });
    this.people.raiders.forEach((r, k) => {
      const p = raiderPose(r, Math.min(1, raidR), this.pose);
      figures += this.placePuppet(this.raiders[k], p, raid && inView(p.x, p.y));
    });
    const now = this.elapsedS;
    for (const c of this.crowd) {
      const on = inView(c.baseX, c.baseY);
      c.sprite.visible = on;
      if (!on) continue;
      figures++;
      const s = Math.sin(now * 2.2 + c.phase);
      c.sprite.y = c.baseY - Math.abs(s) * 2;
      c.sprite.x = c.baseX + Math.sin(now * 0.4 + c.phase) * 6;
      c.sprite.texture = c.frames[s > 0 ? 0 : 1];
    }
    this.boats.forEach((b, k) => {
      const home = this.city.boats[k].home;
      b.y = home.y + Math.sin(now * 1.3 + k) * 4;
      b.x = home.x - (raid ? Math.min(1, raidR) * 120 : 0);
    });

    // Particles: fire on 6 buildings, smoke (budgeted), sparks, arrows during the raid.
    const pool = this.pool;
    for (const f of this.fires) {
      pool.spawn(KIND_FIRE, f.x + this.rng.range(-14, 14), f.y, this.rng.range(-8, 8), this.rng.range(-50, -30), this.rng.range(0.6, 1.1), this.rng.range(5, 9), 4);
      pool.spawn(KIND_SMOKE, f.x, f.y - 20, this.rng.range(-6, 10), -26, 3.2, 6, 3);
      if (this.rng.next() < 0.3) pool.spawn(KIND_SPARK, f.x, f.y, this.rng.range(-30, 30), this.rng.range(-80, -40), 0.8, 2);
    }
    if (raid && this.towers.length) {
      for (let k = 0; k < 2; k++) {
        const tw = this.rng.pick(this.towers);
        const target = this.raiders.length ? raiderPose(this.rng.pick(this.people.raiders), Math.min(1, raidR), this.pose) : { x: tw.x + 200, y: tw.y + 200 };
        const dx = target.x - tw.x, dy = target.y - tw.y, l = Math.hypot(dx, dy) || 1;
        pool.spawn(KIND_ARROW, tw.x, tw.y, (dx / l) * 380, (dy / l) * 380 - 60, Math.min(2, l / 380), 4);
      }
    }
    pool.step(dt);
    this.drawParticles();
    if (this.bloomRT) {
      const k = this.resolution * this.cfg.bloomResolution;
      const m = this.worldFx.localTransform.clone().scale(k, k);
      this.app.renderer.render({ container: this.worldFx, target: this.bloomRT, clear: true, transform: m });
    }

    return { phase, raid, cinematic, settled: cam.settled, zoom: cam.zoom, visibleSprites: visible + figures, particles: pool.count, rebaked };
  }

  private placePuppet(p: Puppet, pose: FigurePose, on: boolean): number {
    p.root.visible = on && pose.visible;
    if (!p.root.visible) return 0;
    p.root.position.set(pose.x, pose.y);
    p.root.scale.x = pose.facing;
    p.root.zIndex = (pose.y / 32 - 1) * 1000 + 600;
    const swing = Math.sin(pose.beat * Math.PI * 2);
    if (p.parts.length) {
      const [legs, torso, armL, armR, head] = p.parts;
      legs.scale.x = pose.walking ? (swing > 0 ? 1 : -1) : 1;
      torso.y = -18 - (pose.walking ? Math.abs(swing) * 2 : Math.abs(swing) * 0.6);
      armL.rotation = pose.walking ? swing * 0.4 : swing * 0.45;
      armR.rotation = pose.walking ? -swing * 0.4 : 0;
      head.rotation = Math.sin(pose.beat * 1.7) * 0.05;
    } else if (p.baked && p.bakedFrames) {
      p.baked.texture = p.bakedFrames[swing > 0 ? 0 : 1];
    }
    return 1;
  }

  private drawParticles(): void {
    const pool = this.pool;
    let a = 0, n = 0;
    const fire = [this.tex("fx/fire/0"), this.tex("fx/fire/1"), this.tex("fx/fire/2"), this.tex("fx/fire/3")];
    const smoke = this.tex("fx/smoke/0"), spark = this.tex("fx/spark"), arrow = this.tex("fx/arrow");
    for (let k = 0; k < pool.count; k++) {
      const kind = pool.kind[k];
      const u = pool.life[k] / pool.max[k];
      const additive = kind === KIND_FIRE || kind === KIND_SPARK;
      const p = additive ? this.addParticles[a++] : this.normalParticles[n++];
      p.x = pool.x[k];
      p.y = pool.y[k];
      const sc = pool.r[k] / 16;
      p.scaleX = p.scaleY = kind === KIND_ARROW ? 1 : sc;
      p.alpha = Math.min(1, u * 1.5) * (kind === KIND_SMOKE ? 0.35 : 1);
      p.rotation = kind === KIND_ARROW ? Math.atan2(pool.vy[k], pool.vx[k]) : 0;
      p.texture = kind === KIND_FIRE ? fire[k & 3] : kind === KIND_SMOKE ? smoke : kind === KIND_SPARK ? spark : arrow;
    }
    for (let k = a; k < this.addParticles.length; k++) this.addParticles[k].alpha = 0;
    for (let k = n; k < this.normalParticles.length; k++) this.normalParticles[k].alpha = 0;
    this.fxAdd.update();
    this.fxNormal.update();
  }

  counts(): { buildings: number; figures: number; particlesCap: number; glows: number; crowd: number } {
    return {
      buildings: this.buildingSprites.length,
      figures: this.villagers.length + this.raiders.length + this.crowd.length,
      particlesCap: this.cfg.particles,
      glows: this.glows.particleChildren.length,
      crowd: this.crowd.length,
    };
  }

  get greyLayer(): Container {
    return this.grey;
  }
}
