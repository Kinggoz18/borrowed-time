/** Small shared DOM pieces for the sheets: tabs, tags and bars. Plain functions over h(). */
import { h, icon, ICON } from "./dom";

export interface TabDef {
  id: string;
  label: string;
  /** extra class (e.g. only-small hides the tab on a laptop) */
  cls?: string;
  ic?: keyof typeof ICON;
}
/** A row of tabs (role=tablist, roving tabindex, arrow keys). `onSelect` gets the new id; the caller swaps the pane. */
export function tabs(label: string, defs: TabDef[], active: string, onSelect: (id: string) => void, cls = ""): HTMLElement {
  const list = h("div", { class: `subtabs ${cls}`.trim(), role: "tablist", "aria-label": label });
  const btns = defs.map((d) =>
    h("button", {
      class: `subtab ${d.cls ?? ""}`.trim(),
      role: "tab",
      type: "button",
      "data-tab": d.id,
      "aria-selected": String(d.id === active),
      tabindex: d.id === active ? "0" : "-1",
      onclick: () => select(d.id, false),
    }, d.ic ? icon(d.ic) : null, d.label),
  );
  const select = (id: string, focus: boolean): void => {
    btns.forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    onSelect(id);
  };
  list.addEventListener("keydown", (e) => {
    const i = btns.findIndex((b) => b.getAttribute("aria-selected") === "true");
    const k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    select(btns[(i + k + btns.length) % btns.length].dataset.tab!, true);
  });
  list.append(...btns);
  return list;
}

export type Tone = "" | "good" | "bad" | "grey" | "gold";
export const tag = (text: string, ic?: keyof typeof ICON, tone: Tone = ""): HTMLElement => h("span", { class: `tag ${tone}`.trim() }, ic ? icon(ic) : null, text);

/** A bar with a text twin: `label` is the words a screen reader hears. */
export function bar2(pct: number, label: string, warn = false): HTMLElement {
  return h("div", { class: "bar2", role: "img", "aria-label": label }, h("i", { class: warn ? "warn" : "", style: `width:${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%` }));
}
