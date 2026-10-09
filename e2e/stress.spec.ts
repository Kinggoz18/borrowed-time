import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Headless Chromium draws WebGL in software (SwiftShader). These runs prove the scene boots,
// renders and records; their frame times are a sanity check, never a phone result.

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function boot(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__bt?.ready || window.__bt?.error, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__bt?.error ?? null)).toBeNull();
}

/** Optional evidence copy: BT_EVIDENCE=<dir> keeps the CSVs for the owner to review. */
function keep(name: string, text: string): void {
  const dir = process.env.BT_EVIDENCE;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, name), text);
}

for (const tier of ["low", "high"] as const) {
  test(`renders the city stress scene on ${tier} and records frame times`, async ({ page }, info) => {
    const errors = watchErrors(page);
    await boot(page, `tier=${tier}&mode=worst`);
    await expect(page.locator("#app canvas")).toBeVisible();
    await page.waitForFunction(() => (window.__bt?.run?.recorder.rows.length ?? 0) >= 4, null, { timeout: 60_000 });
    const s = await page.evaluate(() => {
      const bt = window.__bt!;
      return {
        tier: bt.run!.cfg.tier,
        drawCalls: bt.run!.lastDrawCalls,
        texMB: bt.run!.texMB,
        visible: bt.last!.visibleSprites,
        raid: bt.last!.raid,
        particles: bt.last!.particles,
        counts: bt.scene!.counts(),
        startupMs: bt.startupMs,
        csv: bt.run!.csv(),
        summary: bt.run!.recorder.summary(),
      };
    });
    expect(s.tier).toBe(tier);
    expect(s.drawCalls).toBeGreaterThan(0);
    expect(s.drawCalls).toBeLessThan(60); // plan budget: < 60 draw calls
    expect(s.texMB).toBeLessThanOrEqual(tier === "low" ? 80 : 128);
    expect(s.visible).toBeGreaterThan(100);
    expect(s.raid).toBe(true);
    expect(s.particles).toBeGreaterThan(20);
    expect(s.counts.crowd).toBe(48 * 33);
    expect(s.summary.seconds).toBeGreaterThanOrEqual(4);
    const shot = await page.screenshot();
    expect(shot.byteLength).toBeGreaterThan(40_000); // a blank or single-colour frame compresses far smaller
    const name = `frames-${tier}-${info.project.name}.csv`;
    await info.attach(name, { body: s.csv, contentType: "text/csv" });
    keep(name, s.csv);
    keep(`summary-${tier}-${info.project.name}.json`, JSON.stringify({ startupMs: s.startupMs, drawCalls: s.drawCalls, texMB: s.texMB, ...s.summary }, null, 1));
    expect(errors).toEqual([]);
  });
}

test("the HUD exports a CSV file", async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, "tier=low&mode=loop");
  await expect(page.getByRole("region", { name: "Performance" })).toBeVisible();
  await page.waitForFunction(() => (window.__bt?.run?.recorder.rows.length ?? 0) >= 2, null, { timeout: 60_000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^bt-phase0-low-loop-\d{8}-\d{4}\.csv$/);
  const path = await file.path();
  const text = (await import("node:fs")).readFileSync(path, "utf8");
  expect(text).toContain("# gate_texture,");
  expect(text).toContain("second,fps,p50,p95,p99");
  expect(errors).toEqual([]);
});

test("the 10-minute check runs to the end (shortened here) and reports thermals", async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, "tier=low&mode=throttle&minutes=0.08");
  await expect(page.getByText(/^Done\./)).toBeVisible({ timeout: 60_000 });
  const finished = await page.evaluate(() => window.__bt!.run!.finished);
  expect(finished).toBe(true);
  expect(errors).toEqual([]);
});

test("the production build hides the HUD and still renders", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("http://127.0.0.1:4173/?tier=low");
  await page.waitForFunction(() => window.__bt?.ready || window.__bt?.error, null, { timeout: 60_000 });
  await page.waitForTimeout(1000);
  await expect(page.locator("#bt-hud")).toHaveCount(0);
  expect(await page.evaluate(() => window.__bt!.run!.lastDrawCalls)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
