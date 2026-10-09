// Headless sim: bundles src/core + the runner, plays every strategy in parallel processes and
// prints the section 6 gate report.  Usage: node scripts/sim.mjs [runs=24] [seasons=45]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".cache", "sim");
export const STRATS = ["never", "balanced", "leverage", "borrowMax", "reckless"];

export async function bundle() {
  await build({
    root, logLevel: "warn", configFile: false, publicDir: false,
    build: { ssr: path.join(root, "scripts/sim-entry.ts"), outDir: out, emptyOutDir: true, target: "node20", rollupOptions: { output: { entryFileNames: "sim-entry.mjs" } } },
  });
  return path.join(out, "sim-entry.mjs");
}
function run(entry, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [entry, ...args], { stdio: ["ignore", "pipe", "inherit"] });
    let s = "";
    p.stdout.on("data", (d) => (s += d));
    p.on("close", (code) => (code === 0 ? resolve(s) : reject(new Error(`sim worker exited ${code}`))));
  });
}
/** Plays all campaigns in parallel chunks; returns the list of JSON files written. */
export async function playAll(entry, runs, seasons) {
  mkdirSync(out, { recursive: true });
  const chunks = Math.max(1, Math.min(4, Math.floor(cpus().length * 2 / STRATS.length)));
  const jobs = [];
  for (const s of STRATS)
    for (let c = 0; c < chunks; c++) {
      const from = 1 + Math.floor((c * runs) / chunks), to = Math.floor(((c + 1) * runs) / chunks);
      if (to >= from) jobs.push({ s, from, to });
    }
  const limit = Math.max(1, cpus().length);
  const files = [];
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const j = jobs[i++];
      const json = await run(entry, ["runs", j.s, String(j.from), String(j.to), String(seasons)]);
      const f = path.join(out, `${j.s}-${j.from}-${j.to}.json`);
      writeFileSync(f, json);
      files.push(f);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return files;
}
export async function report(entry, files) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [entry, "report", ...files], { stdio: ["ignore", "pipe", "inherit"] });
    let s = "";
    p.stdout.on("data", (d) => (s += d));
    p.on("close", (code) => resolve({ code, text: s }));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const runs = +(process.argv[2] || 24), seasons = +(process.argv[3] || 45);
  const t0 = Date.now();
  const entry = await bundle();
  const files = await playAll(entry, runs, seasons);
  const r = await report(entry, files);
  console.log(r.text);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exitCode = r.code;
}
