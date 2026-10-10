/**
 * The Long Dusk shadow: enormous against the fixed island, framed whole at every screen size, in three beats
 * (rising, peak, sinking). Screenshots go to $BT_EVIDENCE when it is set.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const EVID = process.env.BT_EVIDENCE ?? "";
if (EVID) mkdirSync(EVID, { recursive: true });
const BASE = "http://127.0.0.1:5191";
const act = (page: Page, id: string) => page.locator(`[data-act="${id}"]`).first();
async function boot(browser: Browser, w: number, h: number, dpr: number, tier: string): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto(`/?tier=${tier}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__bt?.ready === true);
  await act(page, "new").click();
  const skip = page.locator('[data-act="intro-skip"]');
  if (await skip.count()) await skip.click();
  await act(page, "borrow").click();
  await page.evaluate(() => {
    const st = window.__bt.state()!;
    st.tier = 2;
    for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) if ((i || j) && !(`${i},${j}` in st.lots)) st.lots[`${i},${j}`] = null;
    st.pal = { n: 0, inv: 1 };
    st.road = { n: 0, inv: 1 };
  });
  await page.waitForTimeout(1500);
  // a night in progress: the session stands still while the shadow plays, as it does in the game
  await page.evaluate(() => {
    window.__bt.state()!.phase = "dusk";
  });
  return page;
}
const res = (won: boolean) => ({ day: 6, season: 1, boss: true, kind: "boss", S: 260, D: 300, decision: "hold", won, loot: 4, stolen: 0, damaged: [], villagersLost: 0 });

const LAYOUTS: Array<[string, number, number, number, string]> = [
  ["667x375@2x", 667, 375, 2, "mid"],
  ["1440x900", 1440, 900, 1, "high"],
  ["1920x1080", 1920, 1080, 1, "high"],
  ["360x800", 360, 800, 2, "mid"],
  ["1440x900-low", 1440, 900, 1, "low"],
];
for (const [name, w, h, dpr, tier] of LAYOUTS) {
  test(`the Long Dusk shadow towers over the island and is never clipped: ${name}`, async ({ browser }) => {
    const page = await boot(browser, w, h, dpr, tier);
    const ring = await page.evaluate(() => window.__bt.lotToScreen("1,1"));
    expect(ring.x).toBeGreaterThan(-1e5);
    type Rect = { x: number; y: number; w: number; h: number; rise: number };
    const watch = async (onRect: (r: Rect, maxH: number) => Promise<void>): Promise<Rect[]> => {
      await page.evaluate((r) => void window.__bt.playRaid(r), res(true));
      const seen: Rect[] = [];
      let maxH = 0;
      for (let n = 0; n < 400; n++) {
        const rect: Rect | null = await page.evaluate(() => window.__bt.shadowRect());
        if (rect && rect.h > 0) {
          seen.push(rect);
          maxH = Math.max(maxH, rect.h);
          await onRect(rect, maxH);
        } else if (seen.length > 3 && !rect) break;
        await page.waitForTimeout(60);
      }
      return seen;
    };
    // the software renderer is slow and uneven, so the beats are picked by what is on screen, not by the clock:
    // rising = about halfway up, peak = fully risen, sinking = back down under 80%
    const got = new Set<string>();
    const snap = async (id: string): Promise<void> => {
      if (got.has(id)) return;
      got.add(id);
      // time stands still for the photograph, so it shows exactly this beat
      await page.evaluate(() => window.__bt.hold(true));
      if (EVID) await page.screenshot({ path: path.join(EVID, `monster-${id}-${name}.png`) });
      await page.evaluate(() => window.__bt.hold(false));
    };
    let n = 0;
    const up = await watch(async (r) => {
      n++;
      if (n > 3 && r.rise > 0.3 && r.rise < 0.7 && !got.has("2-peak")) await snap("1-rising");
      if (r.rise >= 0.99) await snap("2-peak");
      if (got.has("2-peak") && r.rise < 0.8) await snap("3-sinking");
    });
    expect(up.length, "the shadow stands for a while").toBeGreaterThan(8);
    expect(got.has("2-peak"), "the shadow reached its full height").toBe(true);
    const maxH = Math.max(...up.map((r) => r.h));
    const peak = up.find((r) => r.rise >= 0.99)!;
    // nowhere in the whole night is it clipped by the screen's sides or top
    for (const r of up) {
      expect(r.x, "left edge").toBeGreaterThanOrEqual(-2);
      expect(r.x + r.w, "right edge").toBeLessThanOrEqual(w + 2);
      expect(r.y, "top edge").toBeGreaterThanOrEqual(-2);
    }
    // at its peak it is enormous: a large share of the screen's width and of its height
    expect(peak.w).toBeGreaterThan(w * 0.25);
    expect(peak.h).toBeGreaterThan(h * 0.2);
    // it rises, then sinks back
    expect(up[0]!.h).toBeLessThan(maxH * 0.8);
    expect(up[up.length - 1]!.h).toBeLessThan(maxH * 0.85);
    await page.context().close();
  });
}
