// Draws the STAND-IN atlases in headless Chromium and writes them to public/standin/<tier>/.
// Usage: npm run standins
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "public/standin");
const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5199/tools/standins.html");
  await page.waitForFunction(() => typeof window.__generate === "function");
  rmSync(out, { recursive: true, force: true });
  for (const tier of ["high", "low"]) {
    const files = await page.evaluate((t) => window.__generate(t), tier);
    for (const f of files) {
      const path = resolve(out, f.path);
      mkdirSync(dirname(path), { recursive: true });
      if (f.dataUrl) writeFileSync(path, Buffer.from(f.dataUrl.split(",")[1], "base64"));
      else writeFileSync(path, f.text);
    }
    console.log(`${tier}: ${files.length} files`);
  }
  writeFileSync(resolve(out, "README.md"), "# Stand-in art\n\nProcedurally drawn placeholders at final resolution and atlas layout (ART_BIBLE.md §7). Not game art. Regenerate with `npm run standins`. Real art replaces these frames by name.\n");
} finally {
  await browser.close();
  await server.close();
}
