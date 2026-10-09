/**
 * The game's screens, in DOM over the Pixi canvas: home, the play HUD and bottom bar, the
 * Build / Building / Clockkeeper sheets, and the cards that need an answer (first run, dusk,
 * raid result, seizure, season end, tier-up, morning), plus settings and the dev-only debug panel.
 */
import * as E from "../core/engine";
import type { GameEvent } from "../core/game";
import { duskRead, rangeBar } from "../core/hints";
import { B, COUNT, EVENTS, LOT_TYPES, TIERS, xpNeed, type BType } from "../core/rules";
import { cloneState } from "../core/snapshot";
import type { IslandState } from "../core/state";
import { lookFor } from "../render/island/layout";
import type { IslandView } from "../render/island/view";
import { buildingFrame } from "../art/island/atlas";
import { FAST, Session } from "../game/session";
import { saveSettings, type Settings } from "../game/settings";
import type { KV } from "../platform/storage";
import type { Cue, Haptics, Sfx } from "../platform/sfx";
import { applyOrientation } from "../platform/orientation";
import { BAND_WORD, BLURB, HIDDEN_TITLE, KIND_TITLE, LINES, LOOK_NAMES } from "./copy";
import { h, icon, type Child } from "./dom";
import { runIntro } from "./intro";

export interface UiDeps {
  view: IslandView;
  sfx: Sfx;
  haptics: Haptics;
  kv: KV;
  settings: Settings;
  dev: boolean;
  onQuality: (q: Settings["quality"]) => void;
  onContinue?: () => void;
  onNew?: () => void;
  onHome?: () => void;
  onReset?: () => void;
  onDevChange?: () => void;
}
type Screen = "home" | "play" | "settings";

const fmt = (n: number): string => (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.floor(n)));
const BUILD_ORDER: BType[] = ["palisade", "field", "cottage", "workshop", "tower", "bank", "road", "trade", "lantern"];

export class GameUI {
  readonly root: HTMLElement;
  session: Session | null = null;
  screen: Screen = "home";
  private hud!: HTMLElement;
  private layer!: HTMLElement;
  private toasts!: HTMLElement;
  private sheetOpen = false;
  private cardOpen = false;
  private coach: "palisade" | "field" | null = null;
  private seen = new Set<string>();
  private selected: string | null = null;
  private hudCache = "";
  private off: (() => void) | null = null;
  private inDusk = false;
  private hoursChip: HTMLElement | null = null;

  constructor(
    host: HTMLElement,
    readonly d: UiDeps,
  ) {
    this.root = h("div", { id: "ui" });
    host.appendChild(this.root);
    // The game is played sideways; Android locks it, a browser held upright gets this note.
    host.appendChild(h("div", { class: "rotate", role: "alert" }, icon("rotate"), h("p", {}, "Turn your phone sideways to play.")));
    d.view.onTapLot = (k) => this.tapLot(k);
    d.view.onTapTent = () => this.openClockkeeper();
  }

  private cue(c: Cue, buzz?: "light" | "medium" | "heavy"): void {
    this.d.sfx.play(c);
    if (buzz) void this.d.haptics.buzz(buzz);
  }

  // ---------- home ----------
  showHome(hasSave: boolean, saveNote = ""): void {
    this.screen = "home";
    this.scoreScene("menu");
    this.root.replaceChildren(
      h(
        "section",
        { class: "home", "data-screen": "home" },
        h("div", { class: "home-title" }, h("h1", {}, "Borrowed Time"), h("p", {}, "Settle an island that keeps its own time.")),
        h(
          "div",
          { class: "home-actions" },
          hasSave && h("button", { class: "btn big primary", "data-act": "continue", onclick: () => this.d.onContinue?.() }, icon("play"), "Continue"),
          h("button", { class: "btn big" + (hasSave ? "" : " primary"), "data-act": "new", onclick: () => this.confirmNew(hasSave) }, icon("tent"), "New colony"),
          h("button", { class: "btn big ghost", "data-act": "settings", onclick: () => this.showSettings("home") }, icon("gear"), "Settings"),
        ),
        saveNote && h("p", { class: "note", role: "status" }, saveNote),
      ),
    );
  }
  private async confirmNew(hasSave: boolean): Promise<void> {
    if (hasSave) {
      const ok = await this.card({ title: "Start over?", body: ["Your island and its ledger will be gone."], buttons: [{ id: "yes", label: "Start a new colony", kind: "danger" }, { id: "no", label: "Keep my island" }] });
      if (ok !== "yes") return;
    }
    this.d.onNew?.();
  }

  // ---------- play ----------
  startPlay(s: Session): void {
    this.session = s;
    this.screen = "play";
    this.off?.();
    this.off = s.on((evs) => this.onEvents(evs));
    this.hud = h("header", { class: "hud", "data-screen": "play" });
    this.toasts = h("div", { class: "toasts", "aria-live": "polite" });
    this.layer = h("div", { class: "layer" });
    const bar = h(
      "nav",
      { class: "bar" },
      h("button", { class: "btn tab", "data-act": "build", onclick: () => this.openBuild() }, icon("build"), h("span", {}, "Build")),
      h("button", { class: "btn tab", "data-act": "keeper", onclick: () => this.openClockkeeper() }, icon("tent"), h("span", {}, "Hesper")),
      h("button", { class: "btn tab", "data-act": "rest", "aria-pressed": "false", onclick: (e) => this.toggleRest(e.currentTarget as HTMLElement) }, icon("fast"), h("span", {}, "Rest 8×")),
    );
    const pauseBtn = h("button", { class: "btn icon-btn pause-btn", "aria-label": "Pause", "data-act": "pause", onclick: () => this.openPause() }, icon("pause"));
    const kids: Child[] = [this.hud, pauseBtn, this.toasts, bar, this.layer];
    if (this.d.dev) kids.push(h("button", { class: "btn icon-btn debug", "aria-label": "Debug", "data-act": "debug", onclick: () => this.openDebug() }, icon("bug")));
    this.root.replaceChildren(...kids.filter((k): k is HTMLElement => !!k));
    this.hudCache = "";
    this.scoreScene();
    this.d.view.setLots(s.state);
    this.d.view.sync(s.state, { dusk: s.state.phase !== "day" });
    this.updateHud();
    void this.bindNativePause();
    this.syncPlayInsets();
    if (!s.meta.storyDone) void this.runStory();
    else if (!s.meta.introDone) void this.firstRun();
    else if (s.state.phase === "dusk") void this.dusk();
    else if (s.state.phase === "night") void this.sleep();
    else this.seasonToast();
  }

  private toggleRest(btn: HTMLElement): void {
    const s = this.session!;
    s.speed = s.speed === 1 ? FAST : 1;
    btn.setAttribute("aria-pressed", String(s.speed !== 1));
    btn.classList.toggle("on", s.speed !== 1);
    this.cue("tap", "light");
  }

  private syncPlayInsets(): void {
    const hud = this.hud?.getBoundingClientRect();
    const bar = this.root.querySelector<HTMLElement>(".bar")?.getBoundingClientRect();
    const top = hud ? hud.bottom : 64;
    const right = bar ? this.appW() - bar.left : 104;
    this.d.view.setPlayInsets(top, right);
  }
  private appW(): number {
    return window.innerWidth;
  }

  /** Called every frame. Text only changes when the numbers do. */
  updateHud(): void {
    const s = this.session;
    if (!s || this.screen !== "play") return;
    this.syncPlayInsets();
    const st = s.state;
    const lim = E.limit(st);
    const left = Math.max(0, st.dayLen - st.hour);
    const g = E.growthNeeds(st);
    const sig = [Math.floor(st.hours), st.debt, lim, st.day, st.season, left, st.pop, st.L, st.tier, st.phase, g.seal, s.meta.colonyName].join("|");
    if (sig === this.hudCache) {
      this.hud.style.setProperty("--light", String(1 - s.dayProgress()));
      return;
    }
    this.hudCache = sig;
    const owed = st.debt > 0;
    const near = owed && st.debt >= 0.8 * lim;
    const nx = TIERS[st.tier + 1];
    this.hud.replaceChildren(
      h(
        "button",
        { class: "colony-badge", "data-act": "profile", onclick: () => this.openProfile(), title: s.meta.colonyName },
        h("span", { class: "level-ring", "aria-hidden": "true", style: `--xp: ${Math.min(1, st.xp / Math.max(1, xpNeed(st.L)))}` }),
        h("span", { class: "colony-text" }, h("b", {}, s.meta.colonyName), h("small", {}, `${TIERS[st.tier].name} · Lv ${st.L}`)),
      ),
      h("div", { class: "chip hours", "data-hud": "hours", title: "Hours" }, icon("hours"), h("b", {}, fmt(st.hours)), h("small", {}, "Hours")),
      h(
        "button",
        { class: "chip debt " + (owed ? (near ? "owed near" : "owed") : "safe"), "data-hud": "debt", onclick: () => this.openClockkeeper() },
        icon(owed ? "owed" : "safe"),
        owed ? h("b", {}, `${fmt(st.debt)}/${fmt(lim)}`) : h("b", {}, "Safe"),
        h("small", {}, owed ? (near ? "Near limit" : "Owed") : "Nothing owed"),
      ),
      h(
        "div",
        { class: "daybox", title: `Season ${st.season}` },
        h(
          "div",
          { class: "hud-row day" },
          icon(st.phase === "day" ? "sun" : "moon"),
          h("span", { "data-hud": "day" }, `Day ${st.day}/6 · `, h("b", {}, st.phase === "day" ? `${left}h light` : st.phase === "dusk" ? "Dusk" : "Night")),
        ),
        h("span", { class: "lightbar", "aria-hidden": "true" }, h("i", {})),
      ),
      nx
        ? h(
            "button",
            { class: "chip charter", "data-hud": "charter", onclick: () => this.openCharter() },
            icon("star"),
            h("span", {}, nx.name),
            // only what still blocks the next tier, at most two items; the sheet has the full list
            ...[
              !g.level && req(false, `Lv ${st.L}/${nx.lvl}`),
              !g.people && req(false, `${st.pop}/${nx.pop}`, "people"),
              !g.kept && req(false, "Over limit"),
              !g.seal && req(false, "Seal"),
            ]
              .filter((x): x is HTMLElement => !!x)
              .slice(0, 2),
            g.level && g.people && g.kept && g.seal ? req(true, "Ready") : null,
          )
        : h("div", { class: "chip charter" }, icon("star"), h("span", {}, `${TIERS[st.tier].name}`)),
    );
    this.hoursChip = this.hud.querySelector(".chip.hours");
    this.hud.style.setProperty("--light", String(1 - s.dayProgress()));
  }

  private floatIncome(n: number): void {
    if (n <= 0 || !this.hoursChip) return;
    const el = h("span", { class: "income-float" }, `+${n < 1 ? n.toFixed(1) : Math.round(n)}`);
    this.hoursChip.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));
    setTimeout(() => el.remove(), 1200);
    this.hoursChip.classList.remove("pop");
    void this.hoursChip.offsetWidth;
    this.hoursChip.classList.add("pop");
  }

  private animateHoursTo(target: number): void {
    const chip = this.hoursChip?.querySelector("b");
    if (!chip) return;
    const from = parseFloat(chip.textContent?.replace("k", "") ?? "0") * (chip.textContent?.includes("k") ? 1000 : 1);
    const t0 = performance.now();
    const step = (): void => {
      const u = Math.min(1, (performance.now() - t0) / 400);
      const v = from + (target - from) * u;
      chip.textContent = fmt(v);
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private onEvents(evs: GameEvent[]): void {
    const s = this.session!;
    const st = s.state;
    let resync = true;
    for (const ev of evs) {
      switch (ev.kind) {
        case "built":
          this.cue("build", "medium");
          if (!B[ev.type].glob) {
            this.d.view.puff(ev.key);
            this.d.view.reveal(ev.key);
          }
          if (this.coach === "palisade" && ev.type === "palisade") this.setCoach("field");
          else if (this.coach === "field" && ev.type === "field") this.setCoach(null);
          break;
        case "upgraded":
          this.cue("upgrade", "medium");
          if (ev.newLook) this.toast(`New look: ${LOOK_NAMES[Math.min(6, Math.floor(ev.n / 3))]} ${B[ev.type].name}`);
          break;
        case "borrowed":
          this.cue("borrow", "light");
          this.once("borrow", LINES.firstBorrow);
          if (E.greyCount(st) > 0) this.once("grey", LINES.firstGrey);
          if (st.debt >= 0.8 * E.limit(st)) this.toast(LINES.nearLimit, "warn");
          break;
        case "repaid":
          this.cue("repay", "light");
          if (ev.cleared) this.toast(LINES.paidOff);
          break;
        case "levelUp":
          this.cue("levelUp", "medium");
          this.toast(`Level ${ev.to}`, "good");
          break;
        case "hourTick":
          this.floatIncome(ev.gain);
          this.animateHoursTo(st.hours);
          break;
        case "dusk":
          resync = false;
          void this.dusk();
          break;
        case "raid":
        case "night":
        case "seized":
          resync = false;
          break;
      }
    }
    if (this.sheetOpen && resync) this.refreshSheet();
    if (resync) {
      this.d.view.setLots(st);
      this.d.view.sync(st, { dusk: st.phase !== "day" });
    }
    this.updateHud();
  }

  private once(id: string, text: string): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.toast(text);
  }
  toast(text: string, kind: "info" | "warn" | "good" = "info"): void {
    const t = h("div", { class: `toast ${kind}`, role: "status" }, text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 2) this.toasts.firstElementChild!.remove();
    setTimeout(() => t.classList.add("out"), 3600);
    setTimeout(() => t.remove(), 4000);
  }
  private seasonToast(): void {
    const st = this.session!.state;
    if (st.day !== 1 || st.hour > 1) return;
    const ev = EVENTS.find((e) => e.id === st.event)!;
    this.toast(`Season ${st.season}: ${ev.name}. ${ev.text}`);
  }

  private setCoach(c: "palisade" | "field" | null): void {
    this.coach = c;
    this.root.querySelector('[data-act="build"]')?.classList.toggle("coach", !!c);
    this.root.querySelector(".coach-tip")?.remove();
    if (c) this.root.appendChild(h("div", { class: "coach-tip", role: "status" }, c === "palisade" ? LINES.coachPalisade : LINES.coachField));
  }

  private bindNativePause(): void {
    void import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      void import("@capacitor/app").then(({ App }) => {
        App.addListener("backButton", () => {
          if (this.cardOpen) return;
          if (this.sheetOpen) this.closeSheet();
          else if (this.screen === "play") this.openPause();
        });
        App.addListener("appStateChange", ({ isActive }) => {
          if (!this.session || this.screen !== "play") return;
          if (!isActive) this.setPaused(true);
          else if (!this.sheetOpen && !this.cardOpen) this.setPaused(false);
        });
      });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && this.session && this.screen === "play") this.setPaused(true);
    });
  }

  private setPaused(on: boolean): void {
    if (!this.session) return;
    this.session.paused = on;
    this.d.view.frozen = on;
  }

  private async runStory(): Promise<void> {
    const s = this.session!;
    this.setPaused(true);
    await new Promise<void>((done) => {
      runIntro(
        this.root,
        () => {
          s.meta.storyDone = true;
          void s.save();
          this.setPaused(false);
          done();
        },
        (line) => {
          const lay = this.d.view.playLayout;
          if (line === 0) this.d.view.showLot("0,0");
          else if (line === 4 && lay) this.d.view.focusWorld(lay.tent.x, lay.tent.y - 20);
          else if (line === 5) this.d.view.fit(false);
        },
      );
    });
    if (!s.meta.introDone) void this.firstRun();
  }

  // ---------- first run ----------
  private async firstRun(): Promise<void> {
    const s = this.session!;
    this.setPaused(true);
    this.scoreScene("hesper");
    const a = await this.card({
      cls: "hesper",
      title: LINES.introTitle,
      body: [LINES.introBody],
      art: "tent",
      buttons: [{ id: "borrow", label: "Borrow 10 Hours", kind: "primary", icon: "hours" }, { id: "no", label: "Not yet" }],
      ask: LINES.introAsk,
    });
    if (a === "borrow") s.do({ t: "borrow", x: 10 });
    s.meta.introDone = true;
    void s.save();
    this.setPaused(false);
    this.scoreScene();
    this.setCoach("palisade");
    setTimeout(() => this.seasonToast(), 600);
  }

  // ---------- sheets ----------
  private sheet(title: string, body: Child[], cls = ""): HTMLElement {
    this.closeSheet();
    this.sheetOpen = true;
    if (this.session) this.setPaused(true);
    const close = h("button", { class: "btn icon-btn", "aria-label": "Close", "data-act": "close", onclick: () => this.closeSheet() }, icon("close"));
    const el = h("div", { class: "sheet-wrap", onclick: (e) => e.target === e.currentTarget && this.closeSheet() }, h("section", { class: `sheet ${cls}`, role: "dialog", "aria-label": title }, h("header", {}, h("h2", {}, title), close), h("div", { class: "sheet-body" }, ...body)));
    this.layer.appendChild(el);
    return el;
  }
  closeSheet(): void {
    this.layer?.querySelector(".sheet-wrap")?.remove();
    this.sheetOpen = false;
    this.selected = null;
    this.d.view.highlight(null);
    this.d.view.setBuildOpen(false);
    if (this.session && !this.cardOpen && !this.inDusk) this.setPaused(false);
    this.scoreScene();
  }
  private refreshSheet(): void {
    const open = this.layer.querySelector<HTMLElement>(".sheet")?.dataset.kind;
    if (open === "build") this.openBuild(this.selected ?? undefined);
    else if (open === "keeper") this.openClockkeeper();
    else if (open === "lot" && this.selected) this.openLot(this.selected);
    else if (open === "glob" && this.selected) this.openGlob(this.selected as "pal" | "road");
  }

  private tapLot(key: string): void {
    const s = this.session;
    if (!s || this.cardOpen || s.state.phase !== "day") return;
    const st = s.state;
    if (key === "pal" || key === "road") return this.openGlob(key);
    if (key === "0,0") return this.toast("The gnomon. It was here before us, keeping the island's time.");
    if (!(key in st.lots)) return;
    this.cue("tap", "light");
    const { owner } = E.claims(st);
    const k = owner[key] ?? key;
    if (st.lots[k]) this.openLot(k);
    else this.openBuild(k);
    // keep the tapped lot in view beside the side sheet
    const cover = this.layer.querySelector(".sheet")?.getBoundingClientRect().width ?? 0;
    this.d.view.focusLot(k, cover);
  }

  openBuild(key?: string): void {
    const s = this.session!;
    const st = s.state;
    if (st.phase !== "day") return;
    this.selected = key ?? null;
    this.d.view.highlight(key ?? null);
    const lot = key ?? undefined;
    const rows = BUILD_ORDER.filter((t) => (B[t].tier ?? 0) <= st.tier + 1).map((t) => {
      const b = B[t];
      const c = E.cost(t, 0, st.L);
      const locked = (b.tier ?? 0) > st.tier;
      const have = b.glob ? (st[b.glob] ? 1 : 0) : E.countOf(st, t);
      const max = COUNT[t][st.tier];
      const builtGlob = b.glob && st[b.glob];
      const ok = !locked && !builtGlob && E.canBuild(st, b.glob ? undefined : lot ?? safest(st), t);
      const why = locked ? `Opens at ${TIERS[b.tier!].name}` : builtGlob ? "Tap the ring or Roads in Build to upgrade" : have >= max ? (b.one ? "Built" : `${have}/${max} built`) : b.credit ? (st.debt + c > E.limit(st) ? "Not enough credit" : "") : st.hours < c ? `Need ${Math.ceil(c - st.hours)} more Hours` : !b.glob && !lot && !safest(st) ? "No free lot" : "";
      const era = this.d.view.currentEra as "colony" | "village";
      const frame = t === "palisade" ? `ring/0/segA` : t === "road" ? `g/${era}/road/0` : buildingFrame(era, lookFor(era, t, 0).frameType, 0);
      return h(
        "div",
        {
          class: "row" + (ok ? "" : " off") + (this.coach === t ? " coach" : "") + (builtGlob ? " built-glob" : ""),
          "data-build": t,
          onclick: builtGlob ? () => this.openGlob(b.glob as "pal" | "road") : undefined,
        },
        h("img", { class: "thumb", src: this.d.view.thumb(frame), alt: "" }),
        h("div", { class: "row-text" }, h("b", {}, b.name), h("span", {}, BLURB[t] ?? ""), why && h("em", {}, why)),
        h(
          "button",
          { class: "btn buy" + (b.credit ? " credit" : ""), disabled: !ok, "data-act": `build-${t}`, onclick: () => this.doBuild(t, lot) },
          icon(b.credit ? "owed" : "hours"),
          h("span", {}, String(c)),
          h("small", {}, b.credit ? "on credit" : "Hours"),
        ),
      );
    });
    const el = this.sheet(key ? "Build here" : "Build", [h("p", { class: "sub" }, key ? "Pick what goes on this lot." : "New buildings go on the safest free lot."), ...rows]);
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "build";
    this.d.view.setBuildOpen(true);
  }
  private doBuild(t: BType, key?: string): void {
    const s = this.session!;
    const evs = s.do({ t: "build", type: t, key: B[t].glob ? undefined : key });
    if (!evs) return this.cue("deny");
    this.closeSheet();
  }

  openGlob(g: "pal" | "road"): void {
    const s = this.session!;
    const st = s.state;
    if (st.phase !== "day") return;
    const type = g === "pal" ? "palisade" : "road";
    const b = E.bAt(st, g);
    if (!b) return;
    this.selected = g;
    this.d.view.highlight(null);
    const def = B[type];
    const c = E.cost(type, b.n + 1, st.L);
    const cap = E.tierCap(st);
    const ok = E.canUpgrade(st, g);
    const era = this.d.view.currentEra as "colony" | "village";
    const frame = g === "pal" ? `ring/0/segA` : `g/${era}/road/0`;
    const body: Child[] = [
      h("div", { class: "lot-head" }, h("img", { class: "thumb big", src: this.d.view.thumb(frame), alt: "" }), h("div", {}, h("b", {}, `Level ${b.n}`), h("span", {}, BLURB[type] ?? ""))),
      b.n >= cap
        ? h("p", { class: "sub" }, `Level ${cap} is the most a ${TIERS[st.tier].name} can build.`)
        : h("button", { class: "btn big primary", disabled: !ok, "data-act": "upgrade", onclick: () => this.doUpgrade(g) }, icon("star"), `Upgrade · ${c} Hours`),
    ];
    const el = this.sheet(def.name, body);
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "glob";
  }

  openLot(key: string): void {
    const s = this.session!;
    const st = s.state;
    const b = st.lots[key];
    if (!b) return;
    this.selected = key;
    this.d.view.highlight(key);
    const def = B[b.type];
    const c = E.cost(b.type, b.n + 1, st.L);
    const cap = E.tierCap(st);
    const ok = E.canUpgrade(st, key);
    const grey = E.greySet(st).has(key);
    const era = this.d.view.currentEra as "colony" | "village";
    const lk = lookFor(era, b.type, b.n);
    const body: Child[] = [
      h("div", { class: "lot-head" }, h("img", { class: "thumb big", src: this.d.view.thumb(buildingFrame(era, lk.frameType, lk.stage, grey)), alt: "" }), h("div", {}, h("b", {}, `Level ${b.n}`), h("span", {}, `${LOOK_NAMES[Math.min(6, Math.floor(b.n / 3))]} look`), h("span", {}, BLURB[b.type] ?? ""), grey && h("span", { class: "tag grey" }, icon("owed"), "Grey land: Hesper's for now. Works at half."))),
      b.lost ? h("p", { class: "sub" }, `${b.lost} level${b.lost > 1 ? "s" : ""} lost to raiders. Rebuilt at half price.`) : null,
      b.n >= cap
        ? h("p", { class: "sub" }, `Level ${cap} is the most a ${TIERS[st.tier].name} can build.`)
        : h("button", { class: "btn big primary", disabled: !ok, "data-act": "upgrade", onclick: () => this.doUpgrade(key) }, icon("star"), `Upgrade · ${c} ${def.credit ? "on credit" : "Hours"}`),
    ];
    if (b.type === "trade") {
      const cap2 = E.tradeCap(st) - st.caravan;
      body.push(
        h("p", { class: "sub" }, `Tomorrow's caravan: ${st.caravan} Hours staked. Price today ×${st.price.toFixed(2)}.`),
        h("div", { class: "pair" }, ...[5, 15].map((x) => h("button", { class: "btn", disabled: cap2 <= 0 || st.hours < 1, "data-act": `caravan-${x}`, onclick: () => (s.do({ t: "caravan", x }) ? (this.cue("coin"), this.openLot(key)) : this.cue("deny")) }, icon("boat"), `Stake ${x}`))),
      );
    }
    const el = this.sheet(def.name, body);
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "lot";
  }
  private doUpgrade(key: string): void {
    if (!this.session!.do({ t: "upgrade", key })) return this.cue("deny");
    if (key === "pal" || key === "road") this.openGlob(key);
    else this.openLot(key);
  }

  openClockkeeper(): void {
    const s = this.session!;
    const st = s.state;
    if (st.phase !== "day") return;
    const lim = E.limit(st);
    const room = lim - st.debt;
    const pct = Math.round(E.rate(st) * 100);
    const preview = (x: number): string => {
      const c = cloneState(st);
      const got = E.borrow(c, x);
      const dl = c.dayLen - st.dayLen;
      return got <= 0 ? "At the limit" : dl > 0 ? `Today +${dl}h light · tomorrow −${dl}h` : "Same daylight";
    };
    const amounts = [...new Set([5, 10, Math.max(1, Math.floor(room / 2)), room].filter((x) => x > 0 && x <= room))].sort((a, b) => a - b).slice(0, 4);
    const body: Child[] = [
      // two columns in landscape: the ledger, then borrow and repay (no scrolling to the actions)
      h(
        "div",
        { class: "col" },
        h("p", { class: "quote" }, "“Tomorrow's light, lent today.”"),
        h(
          "div",
          { class: "ledger" },
          h("div", {}, icon(st.debt ? "owed" : "safe"), h("b", {}, st.debt ? `You owe ${st.debt}` : "You owe nothing"), h("span", {}, `Limit ${lim}`)),
          h("div", { class: "meter", role: "img", "aria-label": `${Math.round((st.debt / lim) * 100)}% of the limit` }, h("i", { style: `width:${Math.min(100, (st.debt / lim) * 100)}%` })),
          h("p", { class: "sub" }, `Interest ${pct}% a night. Go over the limit at night and Hesper takes a building.`),
          E.greyCount(st) > 0 && h("p", { class: "tag grey" }, icon("owed"), `${E.greyCount(st)} lots are grey: they work at half until you repay.`),
        ),
      ),
      h(
        "div",
        { class: "col" },
        h("h3", {}, "Borrow"),
        amounts.length
          ? h("div", { class: "grid2" }, ...amounts.map((x) => h("button", { class: "btn opt", "data-act": `borrow-${x}`, onclick: () => (s.do({ t: "borrow", x }) ? this.openClockkeeper() : this.cue("deny")) }, h("b", {}, `+${x} Hours`), h("small", {}, preview(x)))))
          : h("p", { class: "sub" }, "No more credit today."),
        h("h3", {}, "Repay"),
        st.debt > 0
          ? h(
              "div",
              { class: "grid2" },
              ...[...new Set([5, 20, st.debt].filter((x) => x <= st.debt))].map((x) =>
                h("button", { class: "btn opt", disabled: st.hours < 1, "data-act": `repay-${x === st.debt ? "all" : x}`, onclick: () => (s.do({ t: "repay", x }) ? this.openClockkeeper() : this.cue("deny")) }, h("b", {}, x === st.debt ? "Repay all" : `Repay ${x}`), h("small", {}, `${Math.min(x, Math.floor(st.hours))} Hours now`)),
              ),
            )
          : h("p", { class: "sub" }, "Nothing to repay."),
      ),
    ];
    const el = this.sheet("Hesper, the Clockkeeper", body, "keeper");
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "keeper";
    this.scoreScene("hesper");
  }

  private openCharter(): void {
    const st = this.session!.state;
    const g = E.growthNeeds(st);
    const nx = g.next;
    if (!nx) return;
    const el = this.sheet(`${nx.name} charter`, [
      h("p", { class: "sub" }, `Meet all four by morning and the island grows into a ${nx.name}.`),
      h(
        "ul",
        { class: "checks" },
        h("li", { class: g.level ? "ok" : "" }, icon(g.level ? "check" : "cross"), `Level ${nx.lvl} (now ${st.L})`),
        h("li", { class: g.people ? "ok" : "" }, icon(g.people ? "check" : "cross"), `${nx.pop} people (now ${st.pop})`),
        h("li", { class: g.kept ? "ok" : "" }, icon(g.kept ? "check" : "cross"), "Not over Hesper's limit"),
        h("li", { class: g.seal ? "ok" : "" }, icon(g.seal ? "check" : "cross"), g.seal ? "No seal on the charter" : `Hesper's seal until day ${st.lien - (st.season - 1) * 6}`),
      ),
      h("p", { class: "sub" }, icon("people"), `Food for ${Math.floor(E.food(st))} · homes for ${E.popRoom(st)}. People only stay if both last.`),
      Math.min(Math.floor(E.food(st)), E.popRoom(st)) < nx.pop && h("p", { class: "tag grey" }, icon("cross"), `Build or upgrade Fields and Cottages: ${nx.pop} people need food and homes.`),
    ]);
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "charter";
  }

  // ---------- cards ----------
  card(o: { title: string; body?: Child[] | string[]; buttons: { id: string; label: string; kind?: "primary" | "danger"; icon?: Parameters<typeof icon>[0]; note?: string; disabled?: boolean }[]; cls?: string; art?: string; ask?: string; kicker?: string }): Promise<string> {
    return new Promise((resolve) => {
      this.cardOpen = true;
      if (this.session) this.setPaused(true);
      this.d.sfx.duck(true);
      const wrap = h("div", { class: "card-wrap" });
      const done = (id: string) => {
        wrap.remove();
        this.cardOpen = !!this.root.querySelector(".card-wrap");
        if (this.session && !this.cardOpen && !this.sheetOpen && !this.inDusk) this.setPaused(false);
        this.d.sfx.duck(false);
        this.cue("tap", "light");
        resolve(id);
      };
      wrap.appendChild(
        h(
          "section",
          { class: `card ${o.cls ?? ""}`, role: "dialog", "aria-modal": "true", "aria-label": o.title },
          o.art && this.session ? h("img", { class: "card-art", src: this.d.view.thumb(o.art), alt: "" }) : null,
          o.kicker && h("p", { class: "kicker" }, o.kicker),
          h("h2", {}, o.title),
          ...(o.body ?? []).map((b) => (typeof b === "string" ? h("p", {}, b) : b)),
          o.ask && h("p", { class: "ask" }, o.ask),
          h(
            "div",
            { class: "card-actions" },
            ...o.buttons.map((b) =>
              h("button", { class: `btn big ${b.kind ?? ""}`, disabled: !!b.disabled, "data-act": b.id, onclick: () => done(b.id) }, b.icon ? icon(b.icon) : null, h("span", {}, b.label, b.note ? h("small", {}, b.note) : null)),
            ),
          ),
        ),
      );
      (this.layer ?? this.root).appendChild(wrap);
      wrap.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
    });
  }

  private async dusk(): Promise<void> {
    const s = this.session!;
    if (this.inDusk) return;
    this.inDusk = true;
    this.closeSheet();
    this.setPaused(true);
    s.speed = 1;
    const rest = this.root.querySelector('[data-act="rest"]');
    rest?.classList.remove("on");
    rest?.setAttribute("aria-pressed", "false");
    this.d.view.sync(s.state, { dusk: true });
    this.scoreScene("dusk");
    this.cue("dusk", "medium");
    const st = s.state;
    const read = duskRead(st);
    const hint = read.hint;
    let decision: E.Decision = "hold";
    if (hint.kind !== "quiet") {
      const D = read.defence;
      const Dw = read.wallsDefence;
      const Db = read.borrowDefence;
      const canB = read.canBorrow;
      const loan = read.loan;
      const [lo, hi] = hint.range!;
      const bar = rangeBar(D, lo, hi);
      const p = this.card({
        cls: "dusk",
        kicker: hint.hidden ? HIDDEN_TITLE : `${KIND_TITLE[hint.kind]} · ${BAND_WORD[hint.band!]}`,
        title: hint.line,
        body: [
          h("p", { class: "dusk-lead" }, hint.hidden ? HIDDEN_TITLE : `${KIND_TITLE[hint.kind]} tonight. ${BAND_WORD[hint.band!]} raid.`),
          duskMeter(D, lo, hi, bar, E.hasB(st, "observatory")),
        ],
        buttons: [
          { id: "hold", label: "Hold", note: `Defence ${D}. Keep your Hours.`, icon: "shield" },
          { id: "walls", label: "Everyone to the walls", note: `Defence ${Dw}. No morning bonus. More hurt if they break in.`, icon: "people" },
          { id: "borrow", label: "Borrow the dusk", note: canB ? `+${loan} Hours on credit. Defence ${Db}. Tomorrow 1h shorter.` : "No credit left.", icon: "owed", disabled: !canB },
        ],
      });
      p.then(() => undefined);
      const pick = await p;
      decision = pick as E.Decision;
      this.cue("horn", "heavy");
    } else {
      await this.card({ cls: "dusk quiet", kicker: KIND_TITLE.quiet, title: hint.line, body: ["Nobody's coming tonight."], buttons: [{ id: "sleep", label: "Sleep", kind: "primary", icon: "moon" }] });
    }
    const preRaid = cloneState(s.state);
    const evs = s.do({ t: "dusk", decision }) ?? [];
    const raid = evs.find((e) => e.kind === "raid");
    this.d.view.setLight(1, true);
    if (raid && raid.kind === "raid" && !("quiet" in raid.result && raid.result.quiet)) {
      const r = raid.result as E.RaidResult;
      this.d.view.sync(preRaid, { dusk: true });
      this.once("raid", LINES.firstRaid);
      this.scoreScene("raid");
      this.d.sfx.duck(true);
      this.d.view.onBattleResolved = () => {
        this.d.view.setLots(s.state);
        this.d.view.sync(s.state, { dusk: true });
        this.updateHud();
      };
      try {
        await this.d.view.playRaid(r);
      } finally {
        this.d.view.onBattleResolved = null;
      }
      this.d.sfx.duck(false);
      this.scoreScene("dusk");
      this.updateHud();
      this.cue(r.won ? "held" : "lost", r.won ? "medium" : "heavy");
      const lines: Child[] = [];
      if (r.won) {
        lines.push(h("p", { class: "good" }, icon("check"), ` +${r.loot} Hours of salvage. A Late boat stays at the docks.`));
        if (!this.seen.has("held")) {
          this.seen.add("held");
          lines.push(h("p", { class: "quote" }, LINES.held));
        }
      } else {
        if (r.stolen) lines.push(h("p", { class: "bad" }, icon("hours"), ` ${r.stolen} Hours taken.`));
        const dmg = r.damaged.filter((d) => d.k !== "pal");
        if (dmg.length) lines.push(h("p", { class: "bad" }, icon("fire"), ` ${dmg.length} building${dmg.length > 1 ? "s" : ""} hit${dmg.some((d) => d.destroyed) ? ", some burned down" : ""}. Grey land first.`));
        if (r.damaged.some((d) => d.k === "pal")) lines.push(h("p", { class: "bad" }, icon("shield"), " The Palisade lost a level."));
        if (r.villagersLost) lines.push(h("p", { class: "bad" }, icon("people"), ` ${r.villagersLost} people lost.`));
        lines.push(h("p", { class: "sub" }, "Knocked-down levels rebuild at half price."));
      }
      await this.card({ cls: r.won ? "held" : "lost", kicker: r.boss ? "The Long Dusk" : "Tonight", title: r.won ? (r.D - r.S < r.S * 0.08 ? "In the nick of time!" : "Held!") : "They broke through.", body: lines, buttons: [{ id: "sleep", label: "Sleep", kind: "primary", icon: "moon" }] });
      this.d.view.sync(s.state, { dusk: true });
    }
    await this.sleep();
    this.scoreScene();
    this.inDusk = false;
  }

  private async sleep(): Promise<void> {
    const s = this.session!;
    if (s.state.phase !== "night") return;
    // seizure plays on the building before the island re-lays
    const preNight = cloneState(s.state);
    const evs = s.do({ t: "night" }) ?? [];
    const night = evs.find((e) => e.kind === "night");
    const seized = evs.find((e) => e.kind === "seized");
    if (seized && seized.kind === "seized") {
      this.d.view.sync(preNight, { dusk: true });
      this.cue("seize", "heavy");
      this.scoreScene("hesper");
      await this.d.view.playSeizure(seized.seizure.k);
      this.d.view.sync(s.state, { dusk: true });
      this.updateHud();
      await this.card({ cls: "hesper", art: "tent", kicker: "Over the limit at night", title: `Hesper took your ${B[seized.seizure.type].name}.`, body: [h("p", { class: "quote" }, LINES.seized), h("p", {}, `${seized.seizure.credit} came off what you owe. Stay under the limit at night to keep your buildings.`)], buttons: [{ id: "ok", label: "Understood", kind: "primary" }] });
      this.scoreScene("dusk");
    }
    const end = evs.find((e) => e.kind === "seasonEnd");
    if (end && end.kind === "seasonEnd") {
      const nextEv = EVENTS.find((e) => e.id === s.state.event)!;
      await this.card({ cls: end.won ? "held" : "lost", kicker: `Season ${end.season} ends`, title: end.won ? "The Long Dusk was held." : "The Long Dusk got in.", body: [h("p", {}, `Next season: ${nextEv.name}. ${nextEv.text}`)], buttons: [{ id: "ok", label: "Next season", kind: "primary", icon: "sun" }] });
    }
    const up = evs.find((e) => e.kind === "tierUp");
    if (up && up.kind === "tierUp") {
      this.cue("tierUp", "heavy");
      this.d.sfx.sting();
      await this.d.view.playTierUp();
      this.d.view.setLots(s.state);
      this.d.view.sync(s.state);
      const t = TIERS[up.tier];
      const unlocks = LOT_TYPES.concat(["road"]).filter((b) => B[b].tier === up.tier).map((b) => B[b].name);
      await this.card({ cls: "tier", kicker: "A new age", title: `${t.name}!`, body: [h("p", { class: "quote" }, up.tier === 1 ? LINES.village : "The island grows."), h("p", {}, `More land, a bigger ring, levels up to ${t.cap}.`), unlocks.length ? h("p", {}, `New: ${unlocks.join(" · ")}`) : null], buttons: [{ id: "ok", label: "Onward", kind: "primary", icon: "star" }] });
    }
    if (night && night.kind === "night") {
      const r = night.result;
      const items: Child[] = [];
      if (r.morning) items.push(h("li", {}, icon("sun"), `+${r.morning} Hours morning bonus`));
      if (r.interest) items.push(h("li", { class: "bad" }, icon("owed"), `+${r.interest} owed in interest`));
      if (r.arrived) items.push(h("li", {}, icon("people"), `${r.arrived} people arrived`));
      if (r.left) items.push(h("li", { class: "bad" }, icon("people"), `${r.left} people left: not enough food or homes`));
      if (r.caravan) items.push(h("li", {}, icon("boat"), `The caravan came back with ${r.caravan} Hours`));
      if (items.length) await this.card({ cls: "morning", kicker: `Season ${s.state.season} · Day ${s.state.day}`, title: "Morning", body: [h("ul", { class: "report" }, ...items)], buttons: [{ id: "ok", label: "Start the day", kind: "primary", icon: "sun" }] });
    }
    this.d.view.setLight(0, false);
    this.d.view.setLots(s.state);
    this.d.view.sync(s.state);
    this.updateHud();
    this.setPaused(false);
    this.seasonToast();
  }

  openPause(): void {
    const body: Child[] = [
      h("button", { class: "btn big primary", "data-act": "resume", onclick: () => this.closeSheet() }, icon("play"), "Resume"),
      h("button", { class: "btn big", "data-act": "profile", onclick: () => this.openProfile() }, icon("people"), "Profile"),
      h("button", { class: "btn big", "data-act": "journal", onclick: () => this.openJournal() }, icon("journal"), "Journal"),
      h("button", { class: "btn big", "data-act": "settings", onclick: () => { this.closeSheet(); this.showSettings("play"); } }, icon("gear"), "Settings"),
      h("button", { class: "btn big", "data-act": "home", onclick: () => { this.closeSheet(); this.d.onHome?.(); } }, icon("home"), "Home"),
    ];
    const el = this.sheet("Paused", body, "pause");
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "pause";
  }

  openProfile(): void {
    const s = this.session!;
    const st = s.state;
    const stats = st.stats;
    const body: Child[] = [
      h("p", { class: "sub" }, `${TIERS[st.tier].name} · Level ${st.L}`),
      h("ul", { class: "report" }, h("li", {}, icon("people"), `${st.pop} people · food ${Math.floor(E.food(st))} · homes ${E.popRoom(st)}`)),
      h("ul", { class: "report" }, h("li", {}, icon("build"), `${E.blds(st).length} buildings on the island`)),
      h("p", { class: "sub" }, `Season ${st.season} · Day ${st.day}`),
      h("h3", {}, "Ledger"),
      h("ul", { class: "report" },
        h("li", {}, `Borrowed ${stats.borrowed} · repaid ${stats.repaid}`),
        h("li", {}, `Raids won ${stats.raidsWon} · lost ${stats.raidsLost}`),
        h("li", {}, `Buildings seized ${stats.seized} · level-ups ${stats.levelUps}`),
      ),
    ];
    const el = this.sheet(s.meta.colonyName, body, "profile");
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "profile";
  }

  openJournal(): void {
    const s = this.session!;
    const lines = s.data.events
      .slice(-24)
      .reverse()
      .map((ev) => {
        if (ev.kind === "raid" && ev.result && !ev.result.quiet) return ev.result.won ? `Night ${ev.day}: we held the wall.` : `Night ${ev.day}: they broke through.`;
        if (ev.kind === "seized") return `Hesper took a ${ev.seizure.type} on day ${ev.day}.`;
        if (ev.kind === "tierUp") return `The island became ${TIERS[ev.tier].name}.`;
        if (ev.kind === "built") return `We raised a ${B[ev.type].name}.`;
        return null;
      })
      .filter((x): x is string => !!x);
    const body: Child[] = [
      h("button", { class: "btn", "data-act": "replay-intro", onclick: () => { this.closeSheet(); void this.runStory(); } }, "Replay the arrival story"),
      lines.length ? h("ul", { class: "report journal" }, ...lines.map((t) => h("li", {}, t))) : h("p", { class: "sub" }, "The ledger is still mostly blank."),
    ];
    const el = this.sheet("Journal", body, "journal");
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "journal";
  }

  /** Scene follows the screen and the hour, never a tap. */
  private scoreScene(scene?: "menu" | "day" | "dusk" | "raid" | "hesper"): void {
    const era = this.session?.state.tier ?? 0;
    if (scene) {
      this.d.sfx.setScene(scene, era);
      return;
    }
    if (!this.session || this.screen === "home") {
      this.d.sfx.setScene("menu", 0);
      return;
    }
    this.d.sfx.setScene(this.session.state.phase === "day" ? "day" : "dusk", era);
  }

  // ---------- settings ----------
  showSettings(from: Screen): void {
    const st = this.d.settings;
    const back = () => {
      if (from === "home") this.d.onHome?.();
      else {
        this.root.querySelector(".settings")?.remove();
        if (this.session && !this.cardOpen && !this.sheetOpen) this.setPaused(false);
      }
    };
    const apply = () => {
      this.d.sfx.setMixer({ sound: st.sound, music: st.music, sfxVol: st.sfxVol, musicVol: st.musicVol });
      this.d.haptics.enabled = st.haptics;
      void saveSettings(this.d.kv, st);
    };
    const toggle = (key: "sound" | "music" | "haptics", label: string, ic: Parameters<typeof icon>[0]) =>
      h("label", { class: "setting" }, icon(ic), h("span", {}, label), h("input", { type: "checkbox", role: "switch", checked: st[key], "data-set": key, onchange: (e) => {
        st[key] = (e.target as HTMLInputElement).checked;
        apply();
        this.cue("tap", "light");
      } }));
    const slider = (key: "musicVol" | "sfxVol", label: string, ic: Parameters<typeof icon>[0]) =>
      h("label", { class: "setting vol" }, icon(ic), h("span", {}, label), h("input", {
        type: "range",
        min: "0",
        max: "100",
        step: "1",
        value: Math.round(st[key] * 100),
        "data-set": key,
        "aria-label": label,
        oninput: (e) => {
          st[key] = Number((e.target as HTMLInputElement).value) / 100;
          apply();
        },
      }));
    if (this.session) this.setPaused(true);
    const panel = h(
      "section",
      { class: "settings", "data-screen": "settings", role: "dialog", "aria-label": "Settings" },
      h("header", {}, h("button", { class: "btn icon-btn", "aria-label": "Back", "data-act": "back", onclick: back }, icon("back")), h("h2", {}, "Settings")),
      toggle("music", "Music", "note"),
      slider("musicVol", "Music volume", "note"),
      toggle("sound", "Sound effects", "sound"),
      slider("sfxVol", "Effects volume", "sound"),
      toggle("haptics", "Vibration", "vibrate"),
      h(
        "label",
        { class: "setting" },
        icon("star"),
        h("span", {}, "Picture quality"),
        h("select", { "data-set": "quality", onchange: (e) => {
          st.quality = (e.target as HTMLSelectElement).value as Settings["quality"];
          void saveSettings(this.d.kv, st);
        } }, ...(["auto", "high", "mid", "low"] as const).map((q) => h("option", { value: q, selected: st.quality === q }, q === "auto" ? "Automatic" : q[0].toUpperCase() + q.slice(1)))),
      ),
      h("p", { class: "note" }, "Picture quality applies next time you open the game."),
      h(
        "label",
        { class: "setting" },
        icon("rotate"),
        h("span", {}, "Screen"),
        h("select", { "data-set": "orientation", onchange: (e) => {
          st.orientation = (e.target as HTMLSelectElement).value as Settings["orientation"];
          void saveSettings(this.d.kv, st);
          void applyOrientation(st.orientation);
        } }, ...(["landscape", "portrait", "auto"] as const).map((o) => h("option", { value: o, selected: st.orientation === o }, o === "auto" ? "Auto" : o[0].toUpperCase() + o.slice(1)))),
      ),
      this.session && h("button", { class: "btn big danger", "data-act": "reset", onclick: async () => {
        const a = await this.card({ title: "Reset the island?", body: ["This deletes your colony for good."], buttons: [{ id: "yes", label: "Delete my colony", kind: "danger" }, { id: "no", label: "Keep it" }] });
        if (a === "yes") this.d.onReset?.();
      } }, icon("cross"), "Reset island"),
      h("p", { class: "note" }, "Borrowed Time · Phase 1 test build"),
    );
    if (from === "home") this.root.replaceChildren(panel);
    else this.root.appendChild(panel);
    this.screen = from === "home" ? "settings" : this.screen;
  }

  // ---------- dev-only debug panel ----------
  private openDebug(): void {
    const s = this.session!;
    const act = (label: string, id: string, fn: () => void) =>
      h("button", { class: "btn opt", "data-act": id, onclick: () => {
        const L0 = s.state.L;
        fn();
        if (s.state.L > L0) {
          this.cue("levelUp", "medium");
          this.toast(`Level ${s.state.L}`, "good");
        }
        this.d.onDevChange?.();
        this.refreshAfterDev();
      } }, h("b", {}, label));
    const el = this.sheet("Debug (dev build only)", [
      h("p", { class: "sub" }, "Changes here restart the replay log from now."),
      h(
        "div",
        { class: "grid2" },
        act("+100 Hours", "dev-hours", () => (s.state.hours += 100)),
        act("+1 level", "dev-level", () => E.gainXP(s.state, Math.max(1, (s.state.L ? 30 * Math.pow(s.state.L, 1.35) : 30) - s.state.xp + 1))),
        act("+20 people", "dev-people", () => (s.state.pop += 20)),
        act("Clear debt", "dev-debt", () => (s.state.debt = 0)),
        act("Skip to dusk", "dev-dusk", () => (s.state.hour = Math.max(s.state.hour, s.state.dayLen - 1))),
        act("Fast clock", "dev-fast", () => (s.speed = s.speed >= 40 ? 1 : 40)),
      ),
    ]);
    el.querySelector<HTMLElement>(".sheet")!.dataset.kind = "debug";
  }
  private refreshAfterDev(): void {
    this.hudCache = "";
    this.d.view.sync(this.session!.state);
    this.updateHud();
  }
}

function req(ok: boolean, text: string, word?: string): HTMLElement {
  return h("span", { class: "req" + (ok ? " ok" : "") }, icon(ok ? "check" : "cross"), text, word ? h("small", {}, ` ${word}`) : null);
}

/** Dusk card hook: defence, a raider range, and a bar against that defence. */
function duskMeter(
  def: number,
  lo: number,
  hi: number,
  bar: { loPct: number; widthPct: number; defPct: number },
  observatory: boolean,
): HTMLElement {
  const counted = observatory ? `Ada counts ${lo}–${hi}.` : `Raiders about ${lo}–${hi}.`;
  return h(
    "div",
    { class: "dusk-read", "data-dusk-def": def, "data-dusk-lo": lo, "data-dusk-hi": hi },
    h("p", { class: "sub dusk-stat" }, icon("shield"), ` Your defence: ${def}`),
    h("p", { class: "sub dusk-stat" }, icon("boat"), ` ${counted}`),
    h(
      "div",
      { class: "dusk-bar", role: "img", "aria-label": `Raiders ${lo} to ${hi} against defence ${def}` },
      h("i", { class: "raid", style: `left:${bar.loPct}%;width:${bar.widthPct}%` }),
      h("b", { class: "mark", style: `left:${bar.defPct}%` }),
    ),
  );
}
const safest = (st: IslandState): string | undefined => E.greyOrder(st).slice().reverse().find((k) => E.isFree(st, k));
