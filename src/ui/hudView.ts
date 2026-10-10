/** The HUD's DOM, one small builder per part. All wording comes from hudModel (UX spec section 4). */
import * as E from "../core/engine";
import { xpNeed } from "../core/rules";
import type { IslandState } from "../core/state";
import { colonyLine, fmt, goalModel, incomeLine, owedChip, timeBox } from "./hudModel";
import { h, icon } from "./dom";
import { HUD } from "./copy";

export function colonyBadge(st: IslandState, name: string, onOpen: () => void): HTMLElement {
  const xp = Math.min(1, st.xp / Math.max(1, xpNeed(st.L)));
  return h(
    "button",
    { class: "plaque colony-badge", "data-act": "profile", type: "button", "aria-label": `${name}. ${colonyLine(st).replace(" · ", ", ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}. Open profile.`, onclick: onOpen },
    h("span", { class: "level-ring", "aria-hidden": "true", style: `--xp:${xp.toFixed(2)}` }, String(st.L)),
    h("span", { class: "colony-text" }, h("b", {}, name), h("small", {}, colonyLine(st))),
  );
}

export function timePlaque(st: IslandState): HTMLElement {
  const t = timeBox(st);
  return h(
    "div",
    { class: "plaque timebox", "data-hud": "day", role: "group", "aria-label": t.label },
    h("div", { class: "tb-top" }, icon(t.icon), h("span", {}, t.day), t.event ? h("span", { class: "tag-ev" }, t.event) : null),
    h("div", { class: "pips", "aria-hidden": "true" }, ...t.pips.map((p) => h("i", { class: [p.done ? "done" : "", p.now ? "now" : "", p.boss ? "boss" : ""].join(" ").trim() }))),
    h("div", { class: "tb-bar" }, h("span", { class: "lightbar", "aria-hidden": "true" }, ...Array.from({ length: t.segments }, (_, i) => h("i", { class: i < t.lit ? "on" : "" }))), h("span", { class: "tb-left" }, t.light)),
  );
}

export function resPlaque(st: IslandState, onDebt: () => void): HTMLElement {
  const lim = E.limit(st);
  const c = owedChip(st.debt, lim);
  const state = c.state === "safe" ? "safe" : `owed${c.state === "near" ? " near" : c.state === "over" ? " over" : ""}`;
  return h(
    "div",
    { class: "plaque res" },
    h("div", { class: "chip hours", "data-hud": "hours", role: "group", "aria-label": `${Math.floor(st.hours)} Hours` }, icon("hours"), h("span", { class: "t" }, h("b", {}, fmt(st.hours)), h("small", {}, "Hours"), h("small", { class: "inc" }, incomeLine(st)))),
    h(
      "button",
      { class: `chip debt ${state}`, "data-hud": "debt", "data-owed": c.state, type: "button", "aria-label": c.label, onclick: onDebt },
      icon(c.state === "safe" ? "safe" : "owed"),
      h("span", { class: "t" }, h("b", {}, c.num), h("small", {}, c.word)),
      c.pct > 0 ? h("span", { class: "m", "aria-hidden": "true" }, h("i", { style: `width:${Math.round(c.pct * 100)}%` })) : null,
    ),
  );
}

/** The charter goal: a chip on a phone, a card with the four rows on a laptop. Null in the last era. */
export function goalButton(st: IslandState, onOpen: () => void): HTMLElement | null {
  const g = goalModel(st);
  if (!g) return null;
  return h(
    "button",
    { class: "goal" + (g.ready ? " ready" : ""), "data-hud": "charter", "data-act": "charter", type: "button", "aria-label": g.label, onclick: onOpen },
    h(
      "span",
      { class: "goal-top" },
      h("span", { class: "icon star" }, icon("star")),
      h("span", { class: "goal-t" }, h("b", {}, g.name), h("small", {}, g.line)),
      h("span", { class: "pipcount", "aria-hidden": "true" }, ...g.rows.map((r) => h("i", { class: r.met ? "on" : "" }))),
    ),
    h(
      "span",
      { class: "goal-rows" },
      ...g.rows.map((r) => h("div", { class: r.met ? "ok" : "no" }, icon(r.met ? "check" : "cross"), h("span", {}, r.title), h("span", {}, r.value))),
    ),
    h("span", { class: "goal-open" }, HUD.openCharter),
  );
}

export interface BarHandlers {
  build: () => void;
  keeper: () => void;
  journal: () => void;
  rest: (btn: HTMLElement) => void;
}
export function actionBar(fast: number, on: BarHandlers): HTMLElement {
  const tab = (act: string, cls: string, ic: Parameters<typeof icon>[0], label: string, key: string, fn: (e: Event) => void, extra: Record<string, string> = {}): HTMLElement =>
    h("button", { class: `btn tab ${cls}`.trim(), "data-act": act, "data-key": key, type: "button", onclick: fn, ...extra }, icon(ic), h("span", {}, label), h("kbd", { class: "key", "aria-hidden": "true" }, key));
  return h(
    "nav",
    { class: "bar", "aria-label": "Actions" },
    tab("build", "main", "build", "Build", "B", () => on.build()),
    tab("keeper", "", "tent", "Hesper", "H", () => on.keeper()),
    tab("journal", "", "journal", "Journal", "J", () => on.journal()),
    tab("rest", "", "fast", `Rest ${fast}×`, "Space", (e) => on.rest(e.currentTarget as HTMLElement), { "aria-pressed": "false" }),
  );
}
