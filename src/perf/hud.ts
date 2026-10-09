/**
 * On-screen perf HUD for the gate runs. Loaded only in dev and in the `gate` build (the APK for
 * the device test); the production build leaves it out entirely.
 */
import type { CommandLog } from "../sim/commands";
import { saveCsv } from "./exportCsv";
import type { PerfRun } from "./runner";

const CSS = `
#bt-hud { position: fixed; top: max(8px, env(safe-area-inset-top)); left: 8px; z-index: 10; max-width: calc(100vw - 16px);
  font: 12px/1.35 system-ui, sans-serif; color: #3D3428; background: rgba(239,230,210,0.92); border: 2px solid #3D3428;
  border-radius: 10px; padding: 6px 8px; font-variant-numeric: tabular-nums; }
#bt-hud .row { white-space: nowrap; }
#bt-hud .btns { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
#bt-hud button { min-height: 32px; min-width: 44px; padding: 0 8px; font: 600 12px system-ui, sans-serif; color: #3D3428;
  background: #E8DCC4; border: 2px solid #3D3428; border-radius: 8px; }
#bt-hud button[aria-pressed="true"] { background: #D9A441; }
#bt-hud .tag { font-size: 11px; color: #7A6A55; }
#bt-hud table { border-collapse: collapse; margin-top: 4px; }
#bt-hud td { padding: 1px 6px 1px 0; }
#bt-hud[data-collapsed="true"] .more { display: none; }
`;

export interface HudOptions {
  run: PerfRun;
  log: CommandLog;
  /** Reload with new URL params (tier, mode, crowd). */
  relaunch: (params: Record<string, string>) => void;
}

export function mountHud({ run, relaunch }: HudOptions): HTMLElement {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement("section");
  el.id = "bt-hud";
  el.setAttribute("aria-label", "Performance");
  el.dataset.collapsed = "false";
  el.innerHTML = `
    <div class="row" data-k="fps">-- fps</div>
    <div class="more">
      <div class="row" data-k="gpu"></div>
      <div class="row" data-k="state"></div>
      <div class="row" data-k="throttle"></div>
      <div class="btns" data-k="tiers"></div>
      <div class="btns">
        <button type="button" data-mode="loop">Loop</button>
        <button type="button" data-mode="worst">Worst</button>
        <button type="button" data-mode="throttle">10-min check</button>
        <button type="button" data-k="crowd">Crowd</button>
      </div>
      <div class="btns">
        <button type="button" data-k="save">Save CSV</button>
        <button type="button" data-k="results">Results</button>
      </div>
      <table data-k="table" hidden></table>
      <div class="tag">Stand-in art · numbers from this device</div>
    </div>
    <div class="btns"><button type="button" data-k="toggle" aria-label="Hide details">Hide</button></div>`;
  document.body.appendChild(el);
  const q = <T extends HTMLElement>(k: string) => el.querySelector(`[data-k="${k}"]`) as T;
  const mode = run.scenario.mode;
  el.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    b.addEventListener("click", () => relaunch({ mode: b.dataset.mode ?? "loop" }));
  });
  const crowd = q<HTMLButtonElement>("crowd");
  crowd.setAttribute("aria-pressed", String(run.scenario.crowd));
  crowd.addEventListener("click", () => relaunch({ crowd: run.scenario.crowd ? "0" : "1" }));
  q<HTMLButtonElement>("save").addEventListener("click", async () => {
    const btn = q<HTMLButtonElement>("save");
    try {
      await saveCsv(run.filename(), run.csv());
      btn.textContent = "Saved";
    } catch {
      btn.textContent = "Not saved, try again";
    }
    setTimeout(() => (btn.textContent = "Save CSV"), 2500);
  });
  const table = q<HTMLTableElement>("table");
  q<HTMLButtonElement>("results").addEventListener("click", () => {
    table.hidden = !table.hidden;
    renderTable();
  });
  const toggle = q<HTMLButtonElement>("toggle");
  toggle.addEventListener("click", () => {
    const c = el.dataset.collapsed !== "true";
    el.dataset.collapsed = String(c);
    toggle.textContent = c ? "Show" : "Hide";
    toggle.setAttribute("aria-label", c ? "Show details" : "Hide details");
  });

  function renderTable(): void {
    if (table.hidden) return;
    table.innerHTML = run
      .gate()
      .map((c) => `<tr><td>${c.verdict === "pass" ? "✓" : c.verdict === "fail" ? "✗" : "–"}</td><td>${c.label}</td><td>${c.measured}</td></tr>`)
      .join("");
  }

  let shownAt = 0;
  const tick = () => {
    const now = performance.now();
    if (now - shownAt > 500) {
      shownAt = now;
      const r = run.lastRow;
      q("fps").textContent = r ? `${r.fps} fps · p50 ${r.p50} · p95 ${r.p95} · p99 ${r.p99} ms` : "measuring…";
      q("gpu").textContent = `${run.lastDrawCalls} draw calls · ${run.texMB.toFixed(0)} MB textures · ${r ? r.heapMB : 0} MB heap`;
      q("state").textContent = `${run.cfg.tier} · ${run.scenario.mode} · ${r ? r.phase : ""}${r?.raid ? " · raid" : ""} · start ${(run.startupMs / 1000).toFixed(2)} s`;
      const th = q("throttle");
      if (run.scenario.mode === "throttle") {
        const left = Math.ceil(run.throttleLeftS);
        th.textContent = run.finished ? `Done. ${run.gate().find((c) => c.id === "thermals")?.measured ?? ""}. Save the CSV.` : `10-min check: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`;
      } else th.textContent = "";
      renderTable();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return el;
}
