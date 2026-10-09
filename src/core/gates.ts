/**
 * The section 6 sim gates (FINAL_PLAN_BT.md), computed from bot campaigns. Pure: campaigns are
 * summarised per run (so they can be played in parallel processes) and then judged here.
 */
import { campaign, pacing, STRATEGY_NAMES, type StrategyName } from "./bots";
import { TIERS, costMul } from "./rules";

export const BANDS: readonly [number, number][] = [[65, 95], [55, 85], [45, 75], [35, 65]];
export const INCOME_FLOOR = [0.1, 0.03, 0.01, 0.005];
/** Tier-scaled longest wait without an advancement, in in-game days (plan §3). */
export const MAX_GAP = [2, 3, 3, 4];
/** Player-time targets in seasons spent in a tier before the next (plan §3): Colony ≤ 2, Village 4–6, Town 8–10. */
export const SEASONS_IN_TIER: readonly [number, number][] = [[0, 2], [4, 6], [8, 10]];

/** What one campaign contributes to the gates. */
export interface RunSummary {
  name: StrategyName;
  seed: number;
  seasons: { tier: number; won: boolean; growth: number; seized: number }[];
  tierDay: Record<number, number>;
  lvlDay: Record<number, number>;
  lvlInc: Record<number, number>;
  pace: ({ win: number[]; gaps: number[] } | null)[];
  breathers: { with: number; without: number }[];
}
export function summarise(name: StrategyName, seed: number, seasons: number): RunSummary {
  const c = campaign(name, seed, seasons);
  return {
    name, seed,
    seasons: c.seasons.map((s) => ({ tier: s.tier, won: s.won, growth: s.growth, seized: s.seized })),
    tierDay: c.tierDay, lvlDay: c.lvlDay, lvlInc: c.lvlInc,
    pace: name === "balanced" ? pacing(c).map((p) => (p ? { win: p.win, gaps: p.gaps } : null)) : [],
    breathers: c.breathers,
  };
}

export interface TierStat {
  n: number;
  win: number;
  growth: number;
  seized: number;
  reached: number;
}
export interface GateResult {
  id: string;
  name: string;
  pass: boolean;
  detail: string;
}
export interface Report {
  runs: number;
  seasons: number;
  table: Record<StrategyName, TierStat[]>;
  levels: { level: number; costMul: number; income: number; daysToNext: number; reachedOn: number }[];
  gates: GateResult[];
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const pq = (a: number[], p: number) => {
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.floor(p * b.length))];
};

/** Every gate the judge reports, in order, with a short title (docs/SIM_GATES.md). */
const TIER_NAMES = ["Colony", "Village", "Town", "City"];
export const GATE_KINDS: Record<string, string> = {
  G1: "season-win band",
  G2: "no dominant strategy",
  G3: "borrowing matters",
  G4: "greed loses",
  G5: "smooth levelling",
  G6: "breathers",
  G7: "income keeps rising",
  G8: "max days without an advancement",
  G9: "player-time seasons per tier",
};
export const GATE_IDS: string[] = [
  ...TIER_NAMES.flatMap((T) => [`G1-${T}`, `G2-${T}`, `G3-${T}`]),
  "G4-borrowMax",
  "G4-reckless",
  "G5",
  "G6",
  ...TIER_NAMES.flatMap((T) => [`G7-${T}`, `G8-${T}`]),
  ...TIER_NAMES.slice(0, 3).map((T) => `G9-${T}`),
];
export const gateTitle = (id: string): string => `${id} ${GATE_KINDS[id.slice(0, 2)]}`;

export function judge(runs: RunSummary[], seasonsPerRun: number): Report {
  const RUNS = new Set(runs.map((r) => r.seed)).size;
  const table = {} as Record<StrategyName, TierStat[]>;
  for (const name of STRATEGY_NAMES) {
    const mine = runs.filter((r) => r.name === name);
    const agg = [0, 1, 2, 3].map(() => ({ n: 0, w: 0, g: 0, z: 0 }));
    const reached = [0, 0, 0, 0];
    for (const r of mine) {
      for (const s of r.seasons) {
        const a = agg[s.tier];
        a.n++;
        a.w += s.won ? 1 : 0;
        a.g += s.growth;
        a.z += s.seized;
      }
      for (const t in r.tierDay) reached[+t]++;
    }
    table[name] = agg.map((a, t) => ({ n: a.n, win: a.n ? (100 * a.w) / a.n : NaN, growth: a.n ? a.g / a.n : NaN, seized: a.n ? a.z / a.n : NaN, reached: reached[t] }));
  }
  const gates: GateResult[] = [];
  const say = (id: string, name: string, pass: boolean, detail: string) => gates.push({ id, name, pass, detail });

  for (let t = 0; t < 4; t++) {
    const T = TIERS[t].name;
    const sane = (["never", "balanced", "leverage"] as StrategyName[]).map((n) => table[n][t]).filter((r) => r.n);
    const avg = mean(sane.map((r) => r.win));
    say(`G1-${T}`, `Season-win band: ${T} competent mean inside ${BANDS[t][0]}-${BANDS[t][1]}%`, sane.length > 0 && avg >= BANDS[t][0] && avg <= BANDS[t][1], `${Math.round(avg)}%`);
    const live = STRATEGY_NAMES.filter((n) => table[n][t].n >= 20);
    const bw = Math.max(...live.map((n) => table[n][t].win));
    const bg = Math.max(...live.map((n) => table[n][t].growth));
    const dom = live.filter((n) => table[n][t].win === bw && table[n][t].growth === bg);
    say(`G2-${T}`, `No dominant strategy: ${T}`, dom.length === 0, dom.length ? `dominant: ${dom.join(",")}` : `best wins ${live.filter((n) => table[n][t].win === bw).join(",")}, best growth ${live.filter((n) => table[n][t].growth === bg).join(",")}`);
    const nv = table.never[t];
    const bb = (["balanced", "leverage"] as StrategyName[]).map((n) => table[n][t]).filter((r) => r.n);
    const dg = Math.max(...bb.map((r) => Math.abs(r.growth - nv.growth) / Math.abs(nv.growth)));
    const dw = Math.max(...bb.map((r) => Math.abs(r.win - nv.win)));
    say(`G3-${T}`, `Borrowing matters: ${T} (>= 10% growth or >= 8 pts win vs never)`, nv.n > 0 && (dg >= 0.1 || dw >= 8), `growth ${Math.round(dg * 100)}%, wins ${Math.round(dw)} pts`);
  }
  for (const n of ["borrowMax", "reckless"] as StrategyName[]) {
    const r = table[n];
    const live = r.filter((x) => x.n);
    const lose = live.every((x) => x.win < 10 || x.growth <= 0) && r[1].reached < RUNS * 0.5;
    say(`G4-${n}`, `Greed loses: ${n} (boss wins < 10% or no growth, and doesn't reach Village)`, lose, `Village ${r[1].reached}/${RUNS}; boss wins ${live.map((x) => Math.round(x.win) + "%").join("/")}`);
  }
  // smooth levelling (balanced)
  const bal = runs.filter((r) => r.name === "balanced");
  const lv: Record<number, number[]> = {};
  const inc: Record<number, number[]> = {};
  for (const r of bal)
    for (const l in r.lvlDay) {
      (lv[+l] = lv[+l] || []).push(r.lvlDay[+l]);
      (inc[+l] = inc[+l] || []).push(r.lvlInc[+l]);
    }
  const maxL = Math.max(...Object.keys(lv).filter((l) => lv[+l].length >= RUNS * 0.8).map(Number));
  const levels: Report["levels"] = [];
  for (let l = 1; l < maxL; l++)
    levels.push({ level: l, costMul: costMul(l), income: mean(inc[l]), daysToNext: +(mean(lv[l + 1]) - mean(lv[l])).toFixed(1), reachedOn: mean(lv[l]) });
  let smooth = true;
  let worst = "";
  for (let i = 2; i < levels.length; i++) {
    const q = levels[i].daysToNext / levels[i - 1].daysToNext;
    if (q > 2.2 || q < 0.5) {
      smooth = false;
      worst += ` L${i + 1}:${q.toFixed(2)}`;
    }
  }
  say("G5", "Smooth levelling: each level's days-to-next is 0.5-2.2x the previous", smooth, smooth ? levels.map((l) => l.daysToNext).join(" > ") : worst.trim());
  const br = runs.flatMap((r) => r.breathers).filter((b) => b.without > 0);
  const weaker = br.filter((b) => b.with < b.without).length;
  say("G6", "Breathers: the raid after a loss or a Long Dusk is weaker than without the breather", br.length > 0 && br.every((b) => b.with <= b.without) && weaker / br.length > 0.9, `${weaker}/${br.length} weaker, none stronger`);
  for (let t = 0; t < 4; t++) {
    const T = TIERS[t].name;
    const win = bal.flatMap((r) => r.pace[t]?.win ?? []);
    const gaps = bal.flatMap((r) => r.pace[t]?.gaps ?? []);
    if (!win.length) {
      say(`G7-${T}`, `Pacing: ${T} income keeps rising`, false, "no data");
      continue;
    }
    const g5 = pq(win, 0.05);
    say(`G7-${T}`, `Pacing: ${T} income keeps rising (6-day growth p5 >= ${INCOME_FLOOR[t] * 100}%)`, g5 >= INCOME_FLOOR[t], `p5 ${(g5 * 100).toFixed(1)}%`);
    const mx = Math.max(...gaps);
    say(`G8-${T}`, `Pacing: ${T} never more than ${MAX_GAP[t]} days without an advancement`, mx <= MAX_GAP[t], `longest ${mx.toFixed(1)}, p90 ${pq(gaps, 0.9).toFixed(1)}`);
  }
  for (let t = 0; t < 3; t++) {
    const T = TIERS[t].name;
    const spent = bal.filter((r) => r.tierDay[t] !== undefined && r.tierDay[t + 1] !== undefined).map((r) => (r.tierDay[t + 1] - r.tierDay[t]) / 6);
    const m = spent.length ? mean(spent) : NaN;
    const [lo, hi] = SEASONS_IN_TIER[t];
    say(`G9-${T}`, `Player-time pacing: balanced bot spends ${lo}-${hi} seasons in ${T}`, spent.length >= RUNS * 0.5 && m >= lo && m <= hi, `${m.toFixed(1)} seasons (${spent.length}/${RUNS} runs left ${T})`);
  }
  return { runs: RUNS, seasons: seasonsPerRun, table, levels, gates };
}

export function formatReport(r: Report): string {
  const lines: string[] = [`Campaigns: ${r.runs} colonies x ${r.seasons} seasons per strategy, from empty land.`];
  lines.push("tier     strategy   seasons  reached  boss-won  growth  seized");
  for (let t = 0; t < 4; t++)
    for (const n of STRATEGY_NAMES) {
      const s = r.table[n][t];
      lines.push(`${TIERS[t].name.padEnd(8)} ${n.padEnd(10)} ${String(s.n).padStart(7)}  ${String(s.reached).padStart(3)}/${r.runs}  ${s.n ? Math.round(s.win) + "%" : "-"}`.padEnd(54) + `${s.n ? Math.round(s.growth) : "-"}`.padStart(6) + `  ${s.n ? s.seized.toFixed(2) : "-"}`);
    }
  lines.push("level  cost-x  income/day  days-to-next  reached-on");
  for (const l of r.levels) lines.push(`${String(l.level).padStart(5)}  ${l.costMul.toFixed(2)}  ${Math.round(l.income).toString().padStart(10)}  ${l.daysToNext.toString().padStart(12)}  ${Math.round(l.reachedOn).toString().padStart(10)}`);
  for (const g of r.gates) lines.push(`${g.pass ? "PASS" : "FAIL"} ${g.id} ${g.name} (${g.detail})`);
  lines.push(r.gates.every((g) => g.pass) ? "ALL GATES PASS" : "SOME GATES FAIL");
  return lines.join("\n");
}
