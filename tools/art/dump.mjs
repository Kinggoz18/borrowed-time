// Usage: node tools/art/dump.mjs <outDir> <era> <scale> <nameRegex>   (needs `npm run dev` on :5191)
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , out = ".cache/art-dump", era = "colony", scale = "4", re = "."] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error", e));
await page.goto("http://127.0.0.1:5191/tools/art/dump.html");
await page.waitForFunction(() => window.dumpReady === true);
const frames = await page.evaluate(([e, s, r]) => window.dumpFrames(e, +s, r), [era, scale, re]);
const meta = {};
for (const [name, f] of Object.entries(frames)) {
  const file = name.replace(/\//g, "__") + ".png";
  writeFileSync(path.join(out, file), Buffer.from(f.png.split(",")[1], "base64"));
  meta[name] = { file, w: f.w, h: f.h, ax: f.ax, ay: f.ay };
}
writeFileSync(path.join(out, "meta.json"), JSON.stringify(meta, null, 1));
console.log(Object.keys(meta).length, "frames ->", out);
await browser.close();
