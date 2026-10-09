/**
 * The plan's pass/fail table (FINAL_PLAN_BT.md §5) evaluated from a run. A check the run did not
 * exercise is "not measured", never a pass.
 */
import type { RunSummary } from "./recorder";

export type Verdict = "pass" | "fail" | "not measured";
export interface Check {
  id: "typical" | "worst" | "startup" | "thermals" | "texture";
  label: string;
  target: string;
  measured: string;
  verdict: Verdict;
}

export interface GateInput {
  mode: "loop" | "worst" | "throttle";
  summary: RunSummary;
  startupMs: number;
  texMB: number;
  budgetMB: number;
  /** Minutes the throttle check was asked to run. */
  throttleMinutes: number;
}

export function evaluateGate(g: GateInput): Check[] {
  const s = g.summary;
  const enough = s.seconds >= 10;
  const typical: Check = {
    id: "typical",
    label: "Typical frame rate",
    target: "60 fps through the day/night loop",
    measured: g.mode === "loop" && enough ? `${s.fpsMedian} fps median` : "run the loop",
    verdict: g.mode === "loop" && enough ? (s.fpsMedian >= 58 ? "pass" : "fail") : "not measured",
  };
  const worstRun = g.mode !== "loop" && enough;
  const worst: Check = {
    id: "worst",
    label: "Worst load",
    target: "1-second average never below 30 fps",
    measured: worstRun ? `${s.fpsWorstSecond} fps worst second` : "run worst load",
    verdict: worstRun ? (s.fpsWorstSecond >= 30 ? "pass" : "fail") : "not measured",
  };
  const startup: Check = {
    id: "startup",
    label: "Startup",
    target: "under about 3 s to an interactive scene",
    measured: g.startupMs > 0 ? `${(g.startupMs / 1000).toFixed(2)} s in the web view (add native launch)` : "not recorded",
    verdict: g.startupMs > 0 ? (g.startupMs < 3000 ? "pass" : "fail") : "not measured",
  };
  const m = s.minuteFps;
  const fullRun = g.mode === "throttle" && m.length >= Math.max(2, Math.floor(g.throttleMinutes));
  const drop = fullRun ? (m[0] - m[m.length - 1]) / m[0] : 0;
  const thermals: Check = {
    id: "thermals",
    label: "Thermals",
    target: "minute 10 within 10% of minute 1",
    measured: fullRun ? `${m[0]} -> ${m[m.length - 1]} fps (${(drop * 100).toFixed(1)}% drop)` : "run the 10-min check",
    verdict: fullRun ? (drop <= 0.1 ? "pass" : "fail") : "not measured",
  };
  const texture: Check = {
    id: "texture",
    label: "Texture memory",
    target: `${g.budgetMB} MB or less`,
    measured: `${g.texMB.toFixed(1)} MB estimated`,
    verdict: g.texMB > 0 ? (g.texMB <= g.budgetMB ? "pass" : "fail") : "not measured",
  };
  return [typical, worst, startup, thermals, texture];
}
