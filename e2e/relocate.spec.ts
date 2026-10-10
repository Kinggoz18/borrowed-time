/**
 * Landmarks the player places (from Town), moving a built building, and the rule that no toast or coach tip
 * ever covers the action bar. Screenshots go to $BT_EVIDENCE when it is set.
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
async function boot(browser: Browser, w: number, h: number, dpr = 1): Promise<Page> {
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
async function dev(page: Page, id: string): Promise<void> {
  await act(page, "debug").click();
  await act(page, id).click();
  await act(page, "close").click();
}
/** Turns the island into a Town with roads and some money, then lets the view catch up. */
async function toTown(page: Page, cottage?: string): Promise<void> {
  await page.evaluate((c) => {
    const st = window.__bt.state()!;
    st.tier = 2;
    for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) if ((i || j) && !(`${i},${j}` in st.lots)) st.lots[`${i},${j}`] = null;
    st.hours = 5000;
    st.debt = 0;
    st.L = 7;
    st.pal = { n: 0, inv: 1 };
    st.road = { n: 0, inv: 1 };
    if (c) st.lots[c] = { type: "cottage", n: 3, inv: 10 };
  }, cottage ?? null);
  await dev(page, "dev-hours");
  await page.waitForTimeout(1500);
}
const at = async (page: Page, spot: string) => {
  await page.evaluate((k) => window.__bt.showLot(k), spot);
  await page.waitForTimeout(150);
  return page.evaluate((k) => window.__bt.lotToScreen(k), spot);
};
const tapSpot = async (page: Page, spot: string) => {
  const p = await at(page, spot);
  await page.mouse.click(p.x, p.y);
};
const rect = (page: Page, sel: string) =>
  page.evaluate((q) => [...document.querySelectorAll<HTMLElement>(q)].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed").map((e) => { const r = e.getBoundingClientRect(); return { sel: e.className + ":" + (e.dataset.act ?? ""), l: r.left, t: r.top, r: r.right, b: r.bottom }; }), sel);

/** No toast, tip or picker bar may touch an action button (or leave the screen). */
async function expectClear(page: Page, label: string): Promise<void> {
  const bar = await rect(page, ".bar [data-act]");
  expect(bar.length, `${label}: action buttons found`).toBeGreaterThanOrEqual(3);
  const floating = await rect(page, ".toast, .coach-tip, .place-bar");
  const vw = page.viewportSize()!;
  for (const f of floating) {
    expect(f.l, `${label}: ${f.sel} inside screen`).toBeGreaterThanOrEqual(0);
    expect(f.r, `${label}: ${f.sel} inside screen`).toBeLessThanOrEqual(vw.width);
    expect(f.b, `${label}: ${f.sel} inside screen`).toBeLessThanOrEqual(vw.height);
    for (const b of bar) {
      const hit = f.l < b.r && b.l < f.r && f.t < b.b && b.t < f.b;
      expect(hit, `${label}: ${f.sel} covers ${b.sel}`).toBe(false);
    }
  }
}

test.describe("landmarks and moving", () => {
  test.skip(() => test.info().project.name !== "phone-960", "one run, at laptop size");

  test("Landmarks are not in the Build sheet before Town; from Town three are offered, then you place one and tap it for its plaque", async ({ browser }) => {
    const page = await boot(browser, 1440, 900);
    await page.keyboard.press("b");
    await expect(page.locator(".sheet[data-kind=build]")).toBeVisible();
    await expect(page.locator("[data-landmark], [data-group=landmarks]")).toHaveCount(0);
    // no card in any group wears an "On credit" badge beside its name
    await expect(page.locator(".bcard .nm .pen")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await toTown(page);
    // nothing stands on the island on its own
    expect(await page.evaluate(() => window.__bt.showLandmark("clock"))).toBeNull();
    await page.keyboard.press("b");
    await expect(page.locator("[data-landmark]")).toHaveCount(3);
    await expect(page.locator("[data-landmark=dial]")).toHaveCount(0);
    await expect(page.locator(".bcard .nm .pen")).toHaveCount(0);
    await shot(page, "build-card-1440x900");
    await page.locator('[data-tab="cat:landmarks"]').click();
    await expect(page.locator("[data-landmark=clock]")).toBeVisible();
    await shot(page, "1-build-landmarks-town");
    await act(page, "landmark-clock").click();
    await expect(page.locator(".place-bar")).toBeVisible();
    await expect(page.locator(".sheet")).toHaveCount(0);
    const target = "p:-2,-2";
    await tapSpot(page, target);
    await expect(act(page, "place-ok")).toBeVisible();
    await expectClear(page, "placing 1440");
    await shot(page, "2-placing-a-landmark");
    await act(page, "place-ok").click();
    await expect(page.locator(".place-bar")).toHaveCount(0);
    expect(await page.evaluate(() => window.__bt.state()!.landmarks)).toEqual({ clock: target });
    const p = await page.evaluate(() => window.__bt.showLandmark("clock"));
    expect(p).not.toBeNull();
    await page.waitForTimeout(500);
    await page.mouse.click(p!.x, p!.y);
    await expect(page.locator('[data-plaque="clock"]')).toBeVisible();
    await expectClear(page, "plaque 1440");
    await shot(page, "3-placed-landmark-with-plaque");
    // the Move button on the plaque starts a free move
    await act(page, "move-landmark").click();
    await expect(page.locator(".place-bar")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".place-bar")).toHaveCount(0);
    const hours = await page.evaluate(() => window.__bt.state()!.hours);
    expect(hours).toBeGreaterThan(4000);
  });

  test("Move a building: select, Move, pick a lit lot, confirm; level kept, small fee, and Escape cancels", async ({ browser }) => {
    const page = await boot(browser, 1440, 900);
    await toTown(page, "2,3");
    const before = await page.evaluate(() => window.__bt.state()!.hours);
    const p = await at(page, "2,3");
    await page.mouse.click(p.x, p.y);
    await expect(page.locator(".sheet[data-kind=lot]")).toBeVisible();
    await expect(act(page, "move")).toBeEnabled();
    await shot(page, "4-relocate-1-select");
    // Escape path first: M starts, Esc cancels, nothing changed
    await page.keyboard.press("m");
    await expect(page.locator('.place-bar[data-place=move]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".place-bar")).toHaveCount(0);
    expect(await page.evaluate(() => window.__bt.state()!.lots["2,3"]?.type)).toBe("cottage");
    await tapSpot(page, "2,3");
    await expect(page.locator(".sheet[data-kind=lot]")).toBeVisible();
    await act(page, "move").click();
    await expect(page.locator('.place-bar[data-place=move]')).toBeVisible();
    await tapSpot(page, "-3,-3");
    await expect(act(page, "place-ok")).toBeVisible();
    await expectClear(page, "move 1440");
    await shot(page, "5-relocate-2-choose-target");
    await act(page, "place-ok").click();
    await expect(page.locator(".place-bar")).toHaveCount(0);
    const s = await page.evaluate(() => { const st = window.__bt.state()!; return { from: st.lots["2,3"], to: st.lots["-3,-3"], hours: st.hours }; });
    expect(s.from).toBeNull();
    expect(s.to).toMatchObject({ type: "cottage", n: 3 });
    expect(before - s.hours).toBeGreaterThan(0);
    expect(before - s.hours).toBeLessThan(40);
    await at(page, "-3,-3");
    await shot(page, "6-relocate-3-done");
    // a lot that is not lit does nothing
    await tapSpot(page, "-3,-3");
    await act(page, "move").click();
    await tapSpot(page, "-3,-3");
    await expect(act(page, "place-ok")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("night: Move is not offered (the sheet shows it disabled or the bar is dark)", async ({ browser }) => {
    const page = await boot(browser, 1440, 900);
    await toTown(page, "2,3");
    await page.evaluate(() => { window.__bt.state()!.phase = "dusk"; });
    await page.keyboard.press("m");
    await expect(page.locator(".place-bar")).toHaveCount(0);
  });
});

test.describe("toasts and tips never cover the action bar", () => {
  test.skip(() => test.info().project.name !== "phone-960", "one run, four layouts");
  const layouts: [string, number, number, number][] = [["1440x900", 1440, 900, 1], ["1920x1080", 1920, 1080, 1], ["667x375@2x", 667, 375, 2], ["360x800", 360, 800, 2]];
  for (const [name, w, h, dpr] of layouts) {
    test(`${name}: the coach tip, season toast, plaque and spot picker sit clear of Build, Hesper and Rest`, async ({ browser }) => {
      const page = await boot(browser, w, h, dpr);
      await expect(page.locator(".coach-tip")).toBeVisible();
      await expect(page.locator(".toast").first()).toBeVisible();
      await expectClear(page, `${name} coach`);
      if (name === "1440x900" || name === "667x375@2x") await shot(page, `toast-fix-${name}`);
      // at Town: the spot picker and a plaque
      await page.locator(".coach-tip").evaluate((e) => e.remove());
      await toTown(page);
      await act(page, "build").click();
      const tab = page.locator('[data-tab="cat:landmarks"]');
      if (await tab.count()) await tab.click();
      await act(page, "landmark-wreck").scrollIntoViewIfNeeded();
      await act(page, "landmark-wreck").click();
      await expect(page.locator(".place-bar")).toBeVisible();
      await expectClear(page, `${name} picker`);
      await tapSpot(page, "p:-2,-2");
      await expect(act(page, "place-ok")).toBeVisible();
      await expectClear(page, `${name} picker with choice`);
      await act(page, "place-ok").click();
      await expectClear(page, `${name} after place`);
      const pt = await page.evaluate(() => window.__bt.showLandmark("wreck"));
      await page.waitForTimeout(500);
      await page.mouse.click(pt!.x, pt!.y);
      await expect(page.locator('[data-plaque="wreck"]')).toBeVisible();
      await expectClear(page, `${name} plaque`);
      await page.context().close();
    });
  }
});
