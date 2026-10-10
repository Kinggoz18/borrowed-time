/**
 * The phone HUD is six calm things in one height: the colony badge, the day, Hours/Owed, Pause, Build and Rest.
 * The Charter lives under Profile; Hesper and Journal live under Pause. Cards (dusk, result, morning) and the HUD never overlap.
 * Screenshots go to $BT_EVIDENCE when it is set.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVID = process.env.BT_EVIDENCE ?? "";
if (EVID) mkdirSync(EVID, { recursive: true });
const BASE = "http://127.0.0.1:5191";
const act = (page: Page, id: string) => page.locator(`[data-act="${id}"]`).first();
async function shot(page: Page, name: string): Promise<void> {
  if (!EVID) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(EVID, `${name}.png`) });
}
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
  return page;
}
type R = { l: number; t: number; r: number; b: number };
const box = (page: Page, sel: string): Promise<R | null> =>
  page.evaluate((q) => {
    const e = document.querySelector<HTMLElement>(q);
    if (!e || e.offsetParent === null) return null;
    const r = e.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }, sel);
const hit = (a: R, b: R): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const HUD_BLOCKS = [".colony-badge", ".timebox", ".res", ".pause-btn"];

const layouts: [string, number, number, number][] = [["390x844", 390, 844, 2], ["360x800", 360, 800, 2], ["667x375@2x", 667, 375, 2], ["800x360@2x", 800, 360, 2]];
test.describe("phone HUD", () => {
  test.skip(() => test.info().project.name !== "phone-960", "one run, four phone layouts");
  for (const [name, w, h, dpr] of layouts) {
    test(`${name}: six items of one height, no Charter chip, no Hesper or Journal buttons; cards stay clear of the HUD`, async ({ browser }) => {
      const page = await boot(browser, w, h, dpr);
      await page.waitForTimeout(1500);
      // six things
      await expect(page.locator(".goal")).toBeHidden();
      await expect(page.locator('.bar [data-act="keeper"]')).toBeHidden();
      await expect(page.locator('.bar [data-act="journal"]')).toBeHidden();
      await expect(page.locator('.bar [data-act="build"]')).toBeVisible();
      await expect(page.locator('.bar [data-act="rest"]')).toBeVisible();
      const rects: Record<string, R> = {};
      for (const s of HUD_BLOCKS) rects[s] = (await box(page, s))!;
      const hs = HUD_BLOCKS.map((s) => Math.round(rects[s].b - rects[s].t));
      expect(new Set(hs).size, `HUD blocks share one height: ${hs.join(",")}`).toBe(1);
      expect(hs[0]).toBeGreaterThanOrEqual(44);
      expect(hs[0]).toBeLessThanOrEqual(52);
      for (let i = 0; i < HUD_BLOCKS.length; i++) for (let j = i + 1; j < HUD_BLOCKS.length; j++) expect(hit(rects[HUD_BLOCKS[i]], rects[HUD_BLOCKS[j]]), `${HUD_BLOCKS[i]} x ${HUD_BLOCKS[j]}`).toBe(false);
      // taps >= 44, text >= 12px, on every visible HUD control
      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const b of document.querySelectorAll<HTMLElement>("#ui .hud button, #ui .bar button")) {
          if (b.offsetParent === null) continue;
          const r = b.getBoundingClientRect();
          if (r.width < 43.5 || r.height < 43.5) out.push(`${b.dataset.act ?? b.dataset.hud} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        for (const t of document.querySelectorAll<HTMLElement>("#ui .hud *, #ui .bar *")) {
          if (t.offsetParent === null || !t.childNodes.length || ![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
          if (parseFloat(getComputedStyle(t).fontSize) < 11.99) out.push(`text ${t.textContent!.trim().slice(0, 14)} ${getComputedStyle(t).fontSize}`);
        }
        return out;
      });
      expect(small).toEqual([]);
      const hudBottom = Math.max(...HUD_BLOCKS.map((s) => rects[s].b));
      await shot(page, `hud-plain-${name}`);
      // Hesper and Journal are still reachable: Pause menu, Profile
      await act(page, "pause").click();
      await expect(act(page, "pause-hesper")).toBeVisible();
      await expect(page.locator(".sheet [data-act=\"journal\"]")).toBeVisible();
      await act(page, "close").click();
      // the Charter entry under Profile
      await act(page, "profile").click();
      await expect(act(page, "open-charter")).toBeVisible();
      await shot(page, `profile-charter-entry-${name}`);
      await act(page, "open-charter").click();
      await expect(page.locator(".sheet")).toContainText("Charter");
      await act(page, "close").click();
      // dusk card, the result card and the morning card
      await act(page, "debug").click();
      await act(page, "dev-dusk").click();
      await act(page, "close").click();
      const cardClear = async (label: string): Promise<void> => {
        const c = await box(page, ".card-wrap .card");
        expect(c, `${label} card`).not.toBeNull();
        for (const s of [...HUD_BLOCKS, ".bar"]) {
          const b = await box(page, s);
          if (b) expect(hit(c!, b), `${label} card covers ${s}`).toBe(false);
        }
        expect(c!.t, `${label} card below the HUD`).toBeGreaterThanOrEqual(hudBottom - 1);
        const hudOverCard = await page.evaluate(() => {
          const c = document.querySelector(".card-wrap .card")!.getBoundingClientRect();
          return c.bottom <= innerHeight + 1 && c.right <= innerWidth + 1;
        });
        expect(hudOverCard, `${label} card on screen`).toBe(true);
      };
      await expect(page.locator(".card.dusk")).toBeVisible({ timeout: 20_000 });
      await cardClear("dusk");
      await shot(page, `dusk-card-${name}`);
      const quiet = await page.locator('.card.dusk [data-act="sleep"]').count();
      if (!quiet) {
        await act(page, "hold").click();
        await expect(page.locator(".card.held, .card.lost").first()).toBeVisible({ timeout: 30_000 });
        await cardClear("result");
        await shot(page, `night-result-card-${name}`);
      } else await shot(page, `night-result-card-${name}`);
      await act(page, "sleep").click();
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(500);
        const c = await box(page, ".card-wrap .card");
        if (c) {
          await cardClear("morning");
          if (i === 0) await shot(page, `morning-card-${name}`);
        }
        const ok = page.locator('.card-wrap [data-act="ok"]');
        if (!(await ok.count())) break;
        await ok.first().click();
      }
      await page.context().close();
    });
  }
});
