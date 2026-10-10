/**
 * The Journal by day: one page per in-game day (newest first, empty days skipped) with Newer / Earlier and a day jumper;
 * filters and chapter headings work per day. Screenshots go to $BT_EVIDENCE when it is set.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVID = process.env.BT_EVIDENCE ?? "";
if (EVID) mkdirSync(EVID, { recursive: true });
const BASE = "http://127.0.0.1:5191";
const act = (page: Page, id: string) => page.locator(`[data-act="${id}"]`).first();
async function boot(browser: Browser, w: number, h: number, dpr: number): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__bt?.ready === true);
  await act(page, "new").click();
  const skip = page.locator('[data-act="intro-skip"]');
  if (await skip.count()) await skip.click();
  await act(page, "borrow").click();
  // a few written days: 1, 3 and 6 of season 1, then days 2 and 5 of season 2 (days between have nothing to say)
  await page.evaluate(() => {
    const ev = window.__bt.events();
    const at = (seq: number, season: number, day: number, era: number) => ({ seq, season, day, era });
    ev.push(
      { kind: "levelUp", from: 4, to: 5, ...at(101, 1, 1, 0) },
      { kind: "seized", seizure: { k: "1,1", type: "workshop", n: 2, credit: 21 }, ...at(102, 1, 3, 0) },
      { kind: "seasonEnd", won: true, ...at(103, 1, 6, 0) },
      { kind: "levelUp", from: 9, to: 10, ...at(104, 2, 2, 1) },
      { kind: "seized", seizure: { k: "1,1", type: "workshop", n: 2, credit: 30 }, ...at(105, 2, 2, 1) },
      { kind: "seasonEnd", won: false, ...at(106, 2, 5, 1) },
    );
  });
  return page;
}
async function openJournal(page: Page, phone: boolean): Promise<void> {
  if (phone) {
    await act(page, "pause").click();
    await page.locator('.sheet [data-act="journal"]').click();
  } else await act(page, "journal").click();
  await expect(page.locator(".j-pager")).toBeVisible();
}
const title = (page: Page) => page.locator(".jp-title");
async function shot(page: Page, name: string): Promise<void> {
  if (!EVID) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(EVID, `${name}.png`) });
}

for (const [name, w, h, dpr, phone] of [["1440x900", 1440, 900, 1, false], ["667x375@2x", 667, 375, 2, true]] as const) {
  test(`the Journal is one page per day: ${name}`, async ({ browser }) => {
    const page = await boot(browser, w, h, dpr);
    await openJournal(page, phone);
    // newest day first; the day with nothing before it is skipped over
    await expect(title(page)).toHaveText("Season 2 · Day 5");
    await expect(page.locator(".j-entry")).toHaveCount(1);
    // the newest age's chapter heading sits on its newest page
    await expect(page.locator(".j-chapter")).toHaveCount(1);
    await expect(act(page, "journal-newer")).toBeDisabled();
    await shot(page, `journal-1-entries-${name}`);
    await act(page, "journal-earlier").click();
    await expect(title(page)).toHaveText("Season 2 · Day 2");
    await expect(page.locator(".j-entry")).toHaveCount(2);
    await expect(page.locator(".j-chapter")).toHaveCount(0);
    await act(page, "journal-earlier").click();
    await expect(title(page)).toHaveText("Season 1 · Day 6");
    // the earlier age's heading opens the page where that age starts
    await expect(page.locator(".j-chapter")).toHaveCount(1);
    await act(page, "journal-earlier").click();
    await expect(title(page)).toHaveText("Season 1 · Day 3");
    await act(page, "journal-newer").click();
    await expect(title(page)).toHaveText("Season 1 · Day 6");
    // the day jumper
    const pick = act(page, "journal-day");
    await expect(pick.locator("option")).toHaveCount(await page.locator(".jp-pick option").count());
    await pick.selectOption("1:1");
    await expect(title(page)).toHaveText("Season 1 · Day 1");
    await expect(act(page, "journal-earlier")).toBeDisabled();
    await shot(page, `journal-2-day-jump-${name}`);
    await pick.selectOption("2:5");
    await expect(title(page)).toHaveText("Season 2 · Day 5");
    // filters work per day: Nights keeps the days that have a night in them
    await page.locator('[data-tab="jf:nights"]').click();
    const days = await page.locator(".jp-pick option").allTextContents();
    expect(days.map((d) => d.replace(/ \(\d+\)$/, ""))).toEqual(["Season 2 · Day 5", "Season 1 · Day 6"]);
    await expect(page.locator(".j-chapter")).toHaveCount(0);
    for (const e of await page.locator(".j-entry").all()) await expect(e).toHaveAttribute("data-kind", /seasonLost|seasonHeld|held|lost|boss|near/i);
    await page.locator('[data-tab="jf:hesper"]').click();
    await expect(title(page)).toHaveText("Season 2 · Day 2");
    await shot(page, `journal-3-hesper-filter-${name}`);
    await page.locator('[data-tab="jf:all"]').click();
    // pager controls are real touch targets and sit inside the sheet
    for (const id of ["journal-newer", "journal-earlier", "journal-day"]) {
      const b = await act(page, id).boundingBox();
      expect(b!.height, id).toBeGreaterThanOrEqual(43.5);
      expect(b!.x, id).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width, id).toBeLessThanOrEqual(w);
    }
    await page.context().close();
  });
}
