/** The sheets' DOM (Profile, Charter, Build, Journal), built from the pure models. Wording lives in copy.ts / journalCopy.ts. */
import * as E from "../core/engine";
import { B, type BType } from "../core/rules";
import type { IslandState } from "../core/state";
import { type LoggedEvent } from "../core/game";
import { BUILD_ORDER, cardFor, groupAffordable, landmarkCards, teaserFor, visibleGroups, type BuildCard } from "./buildMenu";
import { charter } from "./charterModel";
import { BLURB, CHARTER, LM, MARKS_EMPTY } from "./copy";
import { h, icon, ICON, type Child } from "./dom";
import { J_EMPTY, J_ERROR, J_FILTERS, J_NONE } from "./journalCopy";
import { ariaFor, journalEntries, journalPages, pageForEra, pageIndexOf, type JEntry, type JFilter } from "./journalModel";
import { ledgerRows, profileColony, profileIsland } from "./profileModel";
import { goalModel } from "./hudModel";
import { bar2, tabs, tag, type Tone } from "./widgets";

type Ic = keyof typeof ICON;
export const isWide = (): boolean => typeof matchMedia === "function" && matchMedia("(min-width:1100px) and (min-height:640px) and (orientation:landscape)").matches;

const BLD_ICON: Partial<Record<BType, Ic>> = {
  palisade: "shield", tower: "shield", field: "sprout", cottage: "home", lantern: "home", workshop: "trade", road: "build", trade: "trade", bank: "hours",
  mirror: "sun", hospital: "people", exchange: "trade", harbour: "boat", observatory: "moon", academy: "journal",
};
const MARK_ICON: Record<string, Ic> = { roof: "home", night: "shield", dusk: "bell", grew: "star", paid: "check", learned: "journal" };

export interface Ctx {
  st: IslandState;
  /** a sprite thumbnail data URL for a building type, as the Build sheet shows it */
  thumb: (t: BType) => string;
  /** a thumbnail for a landmark, or "" when its art is not loaded */
  landmarkThumb?: (id: string) => string;
  hesper: () => void;
  close: () => void;
}

/** Swaps panes inside a sheet: every `[data-pane]` whose group is `g` is shown only for the chosen value. */
function paneSwitch(root: HTMLElement, g: string, v: string): void {
  root.querySelectorAll<HTMLElement>(`[data-pane^="${g}:"]`).forEach((e) => {
    e.hidden = !e.dataset.pane!.slice(g.length + 1).split(",").includes(v);
  });
}

// ---------- Profile ----------
/** "Village Charter, 2 of 4 ready": the way to the Charter from Profile (the phone HUD has no Charter chip). Null in the last era. */
function charterEntry(c: Ctx, open?: () => void): HTMLElement | null {
  const g = goalModel(c.st);
  if (!g || !open) return null;
  return h(
    "button",
    { class: "btn charter-entry" + (g.ready ? " primary" : ""), type: "button", "data-act": "open-charter", "aria-label": g.label, onclick: open },
    icon("star"),
    h("span", { class: "t" }, h("b", {}, g.name), h("small", {}, g.line)),
  );
}
export function profileView(c: Ctx, offered: readonly BType[], meta: { colonyName: string; onCharter?: () => void }): Child[] {
  const st = c.st;
  const col = profileColony(st);
  const isl = profileIsland(st, offered);
  const led = ledgerRows(st);
  const colony = h(
    "div",
    { class: "id-col wide-always", "data-pane": "profile:colony", role: "tabpanel" },
    h(
      "div",
      { class: "id-card", style: `--xp:${col.xpPct.toFixed(2)}` },
      h("div", { class: "big-ring", style: `--xp:${col.xpPct.toFixed(2)}`, "aria-hidden": "true" }, String(col.level)),
      h("h3", {}, `Level ${col.level}`),
      h("p", { class: "sub" }, col.kicker),
      h("div", { class: "xp" }, h("div", { class: "num", style: "font-weight:800;font-size:var(--t-sm)" }, col.toNext), h("div", { class: "xpbar", role: "progressbar", "aria-valuenow": String(Math.floor(col.xpNow)), "aria-valuemin": "0", "aria-valuemax": String(col.xpMax), "aria-label": `Progress to Level ${col.level + 1}` }, h("i", { style: `width:${Math.round(col.xpPct * 100)}%` }))),
    ),
    charterEntry(c, meta.onCharter),
    h("div", { class: "stats" }, ...col.stats.map((s) => h("div", { class: "stat" }, h("b", {}, String(s.n)), h("span", {}, s.label)))),
    h(
      "div",
      {},
      h("h3", { class: "sec" }, icon("seal"), "Marks"),
      col.marks.length ? h("div", { class: "marks" }, ...col.marks.map((m) => h("div", { class: "mark" }, icon(MARK_ICON[m.id] ?? "star"), h("b", {}, m.name), h("span", {}, m.line)))) : h("p", { class: "sub" }, MARKS_EMPTY),
    ),
  );
  const gauge = (label: string, g: { pct: number; value: string; short: boolean }, note: string | null): HTMLElement =>
    h("div", { class: "gauge" }, h("div", { class: "row1" }, label, h("span", { class: "num", style: g.short ? "color:var(--debt-ink)" : "" }, g.value)), bar2(g.pct, `${label}: ${g.value}`, g.short), note ? h("p", { class: "sub" }, note) : null);
  const island = h(
    "div",
    { "data-pane": "profile:island", role: "tabpanel" },
    h("h3", { class: "sec" }, icon("people"), "People"),
    gauge("Fed", isl.fed, isl.hungry),
    gauge("Homes", isl.homes, isl.rough),
    h("h3", { class: "sec" }, icon("build"), "Buildings"),
    h("ul", { class: "bldg" }, ...isl.buildings.flatMap((b) => [h("li", { class: "nm" }, icon(BLD_ICON[b.type] ?? "build"), b.name), h("li", { class: "num" }, b.value)])),
    isl.grey ? h("p", { style: "margin-top:10px" }, tag(isl.grey, "owed", "grey")) : null,
  );
  const ledger = h(
    "div",
    { "data-pane": "profile:ledger", role: "tabpanel" },
    h("h3", { class: "sec" }, icon("owed"), "Hesper's ledger"),
    h("ul", { class: "ledger-l" }, ...led.map((r) => h("li", { class: r.bad ? "bad" : "" }, icon(r.bad ? "owed" : r.label.startsWith("Nights") || r.label.startsWith("Long") ? "shield" : "hours"), r.label, h("span", { class: "dots" }), h("b", {}, String(r.n))))),
  );
  ledger.append(h("button", { class: "btn", type: "button", "data-act": "visit-hesper", style: "margin-top:12px", onclick: c.hesper }, icon("tent"), "Visit Hesper"));
  const root = h("div", { class: "sb" }, h("div", { class: "profile" }, colony, h("div", { class: "tabcol" }, island, ledger)));
  const show = (id: string): void => paneSwitch(root, "profile", id);
  const strip = tabs("Profile", [{ id: "colony", label: "Colony", cls: "only-small", ic: "profile" }, { id: "island", label: "Island", ic: "home" }, { id: "ledger", label: "Ledger", ic: "journal" }], isWide() ? "island" : "colony", show);
  show(isWide() ? "island" : "colony");
  void meta;
  return [strip, root];
}

// ---------- Charter ----------
export function charterView(c: Ctx, o: { onGo: (go: "build-dwellings" | "build-food" | "hesper") => void; offered: readonly BType[]; thumbOf: (t: BType) => string; startTab?: "needs" | "gets" }): Child[] | null {
  const m = charter(c.st, o.offered);
  if (!m.next) return null;
  const nx = m.next;
  const row = (r: (typeof m.rows)[number]): HTMLElement =>
    h(
      "li",
      { class: "req" + (r.met ? " met" : ""), "data-req": r.id },
      h("span", { class: "state" }, icon(r.met ? "check" : "cross")),
      h("b", {}, r.id === "people" ? icon("people") : null, r.title),
      h("span", { class: "val" }, r.value),
      r.pct !== undefined ? h("div", { class: "bar2", "aria-hidden": "true" }, h("i", { style: `width:${Math.round(r.pct * 100)}%` })) : null,
      r.hint ? h("span", { class: "hint" }, r.hint) : null,
      r.action ? h("button", { class: "btn small seal", type: "button", "data-act": r.action.go, onclick: () => o.onGo(r.action!.go) }, r.action.label) : null,
    );
  const needs = h(
    "div",
    { class: "wide-always", "data-pane": "charter:needs" },
    h("div", { class: "charter-needs" },
      h("div", { class: "ch-hero" }, h("div", { class: "count" }, String(m.met), h("small", {}, " of 4")), h("p", {}, m.hero), h("div", { class: "seals", "aria-hidden": "true" }, ...m.rows.map((r) => h("i", { class: r.met ? "on" : "" })))),
      m.ready ? h("div", { class: "banner" }, icon("seal"), CHARTER.banner) : null,
      h("ul", { class: "req-list", style: "margin-top:10px" }, ...m.rows.map(row)),
      m.ready ? h("div", { class: "ch-foot" }, h("button", { class: "btn primary", type: "button", "data-act": "close", onclick: c.close }, CHARTER.keepGoing)) : null,
    ),
  );
  const gets = h(
    "div",
    { class: "wide-always", "data-pane": "charter:gets" },
    h("div", { class: "charter-gets" },
      h("div", { class: "age-arc", "aria-label": `From ${m.next ? nameOf(c.st.tier) : ""} to ${nx.name}` }, h("span", {}, nameOf(c.st.tier)), h("span", { class: "dot" }), h("span", { class: "line" }), h("span", { class: "dot next" }), h("span", {}, nx.name)),
      h("h3", { class: "sec", style: "margin-top:12px" }, `What the ${nx.name} brings`),
      ...m.rewards.map((r) => h("div", { class: "reward" }, icon(r.icon), h("b", {}, r.title), h("span", {}, r.line))),
      m.unlocks.length ? h("h3", { class: "sec", style: "margin-top:8px" }, CHARTER.newToBuild) : null,
      m.unlocks.length ? h("div", { class: "unlocks" }, ...m.unlocks.map((t) => h("span", { class: "unlock" }, o.thumbOf(t) ? h("img", { alt: "", src: o.thumbOf(t) }) : icon(BLD_ICON[t] ?? "build"), B[t].name))) : null,
    ),
  );
  const root = h("div", { class: "sb" }, h("div", { class: "charter" }, needs, gets));
  const show = (id: string): void => paneSwitch(root, "charter", id);
  const start = o.startTab ?? "needs";
  const strip = tabs("Charter", [{ id: "needs", label: CHARTER.needs }, { id: "gets", label: CHARTER.gets }], start, show, "small-only");
  show(start);
  return [strip, root];
}
const nameOf = (tier: number): string => ["Colony", "Village", "Town", "City"][tier] ?? "";

// ---------- Build ----------
export interface BuildOpts {
  lot?: string;
  coach: BType | null;
  cat: string;
  onCat: (id: string) => void;
  onBuy: (t: BType) => void;
  onUpgradeGlob: (g: "pal" | "road") => void;
  onHesper: () => void;
  /** Place (or move) a landmark: the sheet closes and the player picks a spot on the island */
  onLandmark?: (id: string) => void;
}
function landmarkEl(c: Ctx, id: string, name: string, placed: boolean, o: BuildOpts): HTMLElement {
  const img = c.landmarkThumb?.(id);
  return h(
    "article",
    { class: "bcard landmark" + (placed ? " done" : ""), "data-landmark": id },
    h("div", { class: "thumb" }, img ? h("img", { alt: "", src: img }) : icon("seal")),
    h("div", { class: "tx" }, h("div", { class: "nm" }, h("b", {}, name), placed ? h("small", {}, LM.placed) : null), h("span", { class: "bl" }, LM.note)),
    h("button", { class: "btn buy", type: "button", "data-act": `landmark-${id}`, "aria-label": `${placed ? LM.move : LM.place} ${name}, ${LM.free}`, onclick: () => o.onLandmark?.(id) }, h("span", { class: "c" }, placed ? LM.move : LM.place), h("small", {}, LM.free)),
  );
}
function cardEl(c: Ctx, cd: BuildCard, o: BuildOpts): HTMLElement {
  const t = cd.type;
  const coach = o.coach === t && cd.buy;
  const cls = ["bcard", cd.state === "hours" || cd.state === "nolot" || cd.state === "credit" ? "off" : "", cd.credit ? "credit" : "", cd.built ? "done" : "", coach ? "coach" : ""].filter(Boolean).join(" ");
  const why =
    cd.state === "hours"
      ? h("span", { class: "why" }, `Need ${cd.need} more Hours `, h("button", { class: "btn link small", type: "button", onclick: (e: Event) => (e.stopPropagation(), o.onHesper()) }, "Visit Hesper"))
      : cd.state === "credit"
        ? h("span", { class: "why" }, "Not enough credit. Repay Hesper first.")
        : cd.state === "nolot"
          ? h("span", { class: "why" }, "No free lot. Upgrade instead.")
          : null;
  const tail: Child = cd.built ? tag("Built", "check", "good") : null;
  const label = `${cd.verb} ${cd.name}, ${cd.cost} ${cd.credit ? "on credit" : "Hours"}`;
  const btn = !cd.built
    ? h(
        "button",
        { class: "btn buy" + (cd.credit ? " credit" : "") + (coach ? " primary" : ""), type: "button", disabled: !cd.buy, "data-act": `build-${t}`, "aria-label": label, onclick: () => (cd.upgrade ? o.onUpgradeGlob(B[t].glob as "pal" | "road") : o.onBuy(t)) },
        h("span", { class: "c" }, icon(cd.credit ? "owed" : "hours"), String(cd.cost)),
        h("small", {}, cd.credit ? "on credit" : cd.verb),
      )
    : null;
  return h(
    "article",
    { class: cls, "data-build": t, onclick: cd.state === "credit" ? o.onHesper : undefined },
    h("div", { class: "thumb" }, c.thumb(t) ? h("img", { alt: "", src: c.thumb(t) }) : icon(BLD_ICON[t] ?? "build")),
    h("div", { class: "tx" }, h("div", { class: "nm" }, h("b", {}, cd.name), cd.meta ? h("small", {}, cd.meta) : null), h("span", { class: "bl" }, BLURB[t] ?? ""), why),
    btn ?? tail,
  );
}

export function buildView(c: Ctx, o: BuildOpts): Child[] {
  const st = c.st;
  const groups = visibleGroups(st.tier, BUILD_ORDER);
  const rail = st.tier >= 1 && groups.length + (landmarkCards(st).length ? 1 : 0) > 1;
  const cat = rail && (o.cat === "all" || groups.some((g) => g.id === o.cat) || (o.cat === "landmarks" && landmarkCards(st).length > 0)) ? o.cat : "all";
  const sect = groups.map((g) => {
    const items = g.types.map((t) => cardEl(c, cardFor(st, t, o.lot), o));
    const teaser = teaserFor(g.id, st.tier, BUILD_ORDER);
    return h(
      "section",
      { class: "group", "data-group": g.id, "data-pane": `cat:all,${g.id}` },
      h("h3", { class: "group-title" }, g.title, h("small", {}, g.tagline)),
      h("div", { class: "group-items" }, ...items, teaser ? h("div", { class: "teaser", role: "note" }, icon("lock"), teaser) : null),
    );
  });
  const lms = landmarkCards(st);
  if (lms.length)
    sect.push(
      h(
        "section",
        { class: "group", "data-group": "landmarks", "data-pane": "cat:all,landmarks" },
        h("h3", { class: "group-title" }, LM.title, h("small", {}, LM.tagline)),
        h("div", { class: "group-items" }, ...lms.map((l) => landmarkEl(c, l.id, l.name, l.placed, o))),
      ),
    );
  const list = h("div", { class: "blist" }, h("div", { class: "blist-head" }, h("p", { class: "sub" }, o.lot ? "Pick what goes on this lot." : "New buildings go on the safest free lot."), o.lot && E.greySet(st).has(o.lot) ? tag("Grey land: Hesper's for now. Buildings here work at half.", "owed", "grey") : null), ...sect);
  const el = h("div", { class: "build" + (rail ? " has-rail" : "") });
  if (rail) {
    const count = (g: (typeof groups)[number]): number => g.types.length;
    const mk = (id: string, label: string, ic: Ic, n: number, dot: boolean): HTMLElement =>
      h("button", { class: "cat", role: "tab", type: "button", "data-tab": `cat:${id}`, "aria-selected": String(id === cat), onclick: () => { o.onCat(id); paneSwitch(list, "cat", id); el.querySelectorAll<HTMLElement>(".cat").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === `cat:${id}`))); } },
        icon(ic), h("span", {}, label), h("span", { class: "n" }, String(n)), dot ? h("span", { class: "dot", title: "Something here you can afford", "aria-label": "Affordable now" }) : null);
    const ic: Record<string, Ic> = { defence: "shield", dwellings: "home", food: "sprout", trade: "trade", civic: "bell" };
    el.append(
      h("div", { class: "cat-rail", role: "tablist", "aria-label": "Kinds of building", "aria-orientation": "vertical" },
        mk("all", "All", "build", groups.reduce((n, g) => n + count(g), 0) + landmarkCards(st).length, groups.some((g) => groupAffordable(st, g, o.lot))),
        ...groups.map((g) => mk(g.id, g.rail, ic[g.id] ?? "build", count(g), groupAffordable(st, g, o.lot))),
        ...(landmarkCards(st).length ? [mk("landmarks", LM.rail, "seal", landmarkCards(st).length, false)] : [])),
    );
    paneSwitch(list, "cat", cat);
  }
  el.append(list);
  return [el];
}

// ---------- Journal ----------
export function journalView(c: Ctx, o: { events: readonly LoggedEvent[]; seed: number; colony: string; days: number; nights: number; onReplay: () => void; refilter?: JFilter }): Child[] {
  let entries: JEntry[] | null = null;
  let failed = false;
  try {
    entries = journalEntries(o.events, o.seed);
  } catch {
    failed = true;
  }
  const portrait = (cls: string): HTMLElement => h("img", { class: cls, src: "/portraits/ada.webp", alt: "Ada" });
  const replay = (cls = "btn small"): HTMLElement => h("button", { class: cls, type: "button", "data-act": "replay-intro", onclick: o.onReplay }, icon("journal"), "Replay the arrival story");
  const root = h("div", { class: "journal" });
  const rebuild = (): void => {
    root.replaceChildren(...(journalView(c, o)[0] as HTMLElement).childNodes);
  };
  if (failed || !entries) {
    root.append(h("div", { class: "jcol" }, h("div", { class: "sb" }, h("div", { class: "state-box" }, portrait("pt"), h("h3", {}, J_ERROR.title), h("p", {}, J_ERROR.text), h("button", { class: "btn primary", type: "button", "data-act": "retry", onclick: rebuild }, "Try again")))));
    return [root];
  }
  const all = entries;
  const era = (all[0]?.era ?? c.st.tier);
  const cover = h(
    "aside",
    { class: "j-cover" },
    h("div", { class: "cover-card" }, h("div", { class: "cover-art" }, portrait("pt"), h("div", {}, h("div", { class: "kicker" }, "Journal"), h("h3", {}, o.colony), h("p", { class: "sub" }, "Kept by Ada, clockmaker's apprentice."))), h("div", { class: "stats", style: "grid-template-columns:1fr 1fr" }, h("div", { class: "stat" }, h("b", {}, String(o.days)), h("span", {}, "Days kept")), h("div", { class: "stat" }, h("b", {}, String(o.nights)), h("span", {}, "Nights held")))),
    h("div", { class: "cover-nav", role: "group", "aria-label": "Jump to" }, h("span", { class: "kicker" }, "Jump to")),
    replay(),
  );
  void era;
  const list = h("div", { class: "j-list" });
  const pager = h("div", { class: "j-pager", role: "group", "aria-label": "Journal days" });
  let filter: JFilter = "all";
  /** the day on show ("season:day"); null = the newest day */
  let day: string | null = null;
  const jump = cover.querySelector<HTMLElement>(".cover-nav")!;
  const paint = (): void => {
    const pages = journalPages(all, filter);
    const at = pageIndexOf(pages, day);
    const page = pages[at];
    day = page?.key ?? null;
    list.replaceChildren();
    pager.replaceChildren();
    pager.hidden = !pages.length;
    jump.querySelectorAll("button").forEach((b) => b.remove());
    if (!all.length) {
      list.append(h("div", { class: "state-box" }, portrait("pt"), h("h3", {}, J_EMPTY.title), h("p", {}, J_EMPTY.text), replay("btn")));
      return;
    }
    if (!page) {
      list.append(h("div", { class: "state-box" }, h("h3", {}, J_NONE.title), h("p", {}, J_NONE.text)));
      return;
    }
    const go = (i: number): void => {
      day = pages[Math.max(0, Math.min(pages.length - 1, i))]!.key;
      paint();
      list.scrollTop = 0;
    };
    // newest day first: "Newer" walks back towards today, "Earlier" walks into the past
    const newer = h("button", { class: "btn small jp-step", type: "button", "data-act": "journal-newer", "aria-label": "Newer day", disabled: at === 0, onclick: () => go(at - 1) }, "\u2039 Newer");
    const older = h("button", { class: "btn small jp-step", type: "button", "data-act": "journal-earlier", "aria-label": "Earlier day", disabled: at === pages.length - 1, onclick: () => go(at + 1) }, "Earlier \u203a");
    const pick = h(
      "select",
      { class: "jp-pick", "aria-label": "Jump to a day", "data-act": "journal-day", onchange: (ev: Event) => { day = (ev.currentTarget as HTMLSelectElement).value; paint(); list.scrollTop = 0; } },
      ...pages.map((p) => h("option", { value: p.key, selected: p.key === page.key }, `${p.label} (${p.count})`)),
    );
    pager.append(newer, h("div", { class: "jp-mid" }, h("b", { class: "jp-title", "data-act": "journal-title" }, page.label), h("span", { class: "jp-of" }, `Page ${at + 1} of ${pages.length}`), pick), older);
    for (const { chapter, entry: e } of page.groups) {
      if (chapter) list.append(h("div", { class: "j-chapter", id: `jc-${chapter.era}` }, h("span", { class: "kicker" }, chapter.kicker), h("h3", {}, chapter.name), h("span", { class: "rule" })));
      list.append(entryEl(e));
    }
    // chapter buttons in the cover walk to the day an age's heading sits on
    for (const p of pages) for (const g of p.groups) if (g.chapter) {
      const era = g.chapter.era;
      jump.append(h("button", { class: "btn small", type: "button", onclick: () => go(pageForEra(pages, era)) }, g.chapter.name));
    }
    list.append(h("div", { class: "j-end" }, replay("btn link small")));
  };
  const filters = h(
    "div",
    { class: "j-filters-wrap" },
    h("div", { class: "j-filters", role: "group", "aria-label": "Show" }, ...J_FILTERS.map((f) => h("button", { class: "chipf", type: "button", "data-tab": `jf:${f.id}`, "aria-pressed": String(f.id === "all"), onclick: (ev: Event) => { filter = f.id; filters.querySelectorAll<HTMLElement>(".chipf").forEach((b) => b.setAttribute("aria-pressed", String(b === ev.currentTarget))); paint(); } }, f.id === "all" ? null : icon(f.icon as Ic), f.label))),
  );
  paint();
  root.append(cover, h("div", { class: "jcol", style: "display:grid;min-height:0;grid-template-rows:auto auto 1fr" }, all.length ? filters : h("div"), pager, list));
  return [root];
}

const TONE: Record<string, Tone> = { Held: "good", Repaid: "good", Built: "good", Lost: "bad", Taken: "bad", Borrowed: "bad", Learned: "gold", "New age": "gold", Found: "gold", Season: "gold" };
function entryEl(e: JEntry): HTMLElement {
  return h(
    "article",
    { class: ["j-entry", e.big ? "big" : "", e.warn ? "warn" : ""].filter(Boolean).join(" "), "data-kind": e.kind, "aria-label": ariaFor(e) },
    h("div", { class: "j-date" }, icon(e.tag.icon), h("b", {}, `Season ${e.season}`), `Day ${e.day}`),
    h("div", { class: "j-head" }, h("h3", { class: "j-title" }, e.title), tag(e.tag.word, e.tag.icon, TONE[e.tag.word] ?? "")),
    h("p", { class: "j-text" }, e.text),
    e.quote ? h("p", { class: "j-quote" }, e.quote) : null,
    e.facts ? h("p", { class: "j-facts" }, e.facts) : null,
  );
}
