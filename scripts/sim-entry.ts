/**
 * Headless sim runner entry (Node, no rendering). Bundled by scripts/sim.mjs.
 *   runs <strategy> <seedFrom> <seedTo> <seasons>   prints a JSON array of run summaries
 *   report <file.json>...                            prints the gate report, exit 1 on a failed gate
 */
import { readFileSync } from "node:fs";
import type { StrategyName } from "../src/core/bots";
import { BUILD, TIERS } from "../src/core/rules";
import { formatReport, judge, summarise, type RunSummary } from "../src/core/gates";

// Tuning experiments: BT_TUNE='{"threat":[1,0.95,1.08,1.12],"BUILD":{"bossDebt":0.7}}'
if (process.env.BT_TUNE) {
  const t = JSON.parse(process.env.BT_TUNE) as { threat?: number[]; lim?: number[]; BUILD?: Record<string, unknown> };
  t.threat?.forEach((v, i) => ((TIERS[i] as { threat: number }).threat = v));
  t.lim?.forEach((v, i) => ((TIERS[i] as { lim: number }).lim = v));
  Object.assign(BUILD, t.BUILD ?? {});
}
const [cmd, ...args] = process.argv.slice(2);
if (cmd === "runs") {
  const [name, from, to, seasons] = [args[0] as StrategyName, +args[1], +args[2], +args[3]];
  const out: RunSummary[] = [];
  for (let s = from; s <= to; s++) out.push(summarise(name, s, seasons));
  process.stdout.write(JSON.stringify(out));
} else if (cmd === "report") {
  const all = args.flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as RunSummary[]);
  const seasons = all[0]?.seasons.length ?? 0;
  const rep = judge(all, seasons);
  console.log(formatReport(rep));
  process.exitCode = rep.gates.every((g) => g.pass) ? 0 : 1;
} else {
  console.error("usage: runs <strategy> <from> <to> <seasons> | report <files>");
  process.exitCode = 2;
}
