/**
 * The playable arc, with real clicks and taps: home → first run → empty land → Palisade ring →
 * build, upgrade, borrow (daylight changes) → a raid with each dusk decision → a level-up →
 * tier-up to Village with the ring re-fit → a seizure → resume from the save → settings. Dev-build debug
 * buttons (also real clicks) skip the waiting. Screenshots go to .artifacts/<run>/e2e/.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const RUN = process.env.BT_RUN ?? "local";
const OUT = path.resolve(".artifacts", RUN, "e2e");
mkdirSync(OUT, { recursive: true });

const st = (page: Page) => page.evaluate(() => window.__bt.state());
async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${test.info().project.name}-${name}.png`) });
}
async function fresh(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__bt?.ready === true);
}
async function skipIntro(page: Page): Promise<void> {
  const skip = page.locator('[data-act="intro-skip"]');
  if (await skip.count()) await skip.click();
  const keep = page.locator('.card-wrap [data-act="skip"]');
  if (await keep.count()) await keep.click();
}
/** Landscape: the whole card or sheet fits the short screen, buttons included (no scrolling). */
async function expectOnScreen(page: Page, sel: string): Promise<void> {
  const off = await page.evaluate((q) => {
    const el = document.querySelector<HTMLElement>(q)!;
    const r = el.getBoundingClientRect();
    return r.top < 0 || r.bottom > innerHeight + 1 || r.left < 0 || r.right > innerWidth + 1 || el.scrollHeight > el.clientHeight + 2;
  }, sel);
  expect(off, `${sel} fits the screen`).toBe(false);
}
const act = (page: Page, id: string) => page.locator(`[data-act="${id}"]`).first();
async function dev(page: Page, id: string): Promise<void> {
  await act(page, "debug").click();
  await act(page, id).click();
  await act(page, "close").click();
}
/** Pan the camera to a lot (as a player would) and return where to tap it. */
async function lotPoint(page: Page, key: string): Promise<{ x: number; y: number }> {
  await page.evaluate((k) => window.__bt.showLot(k), key);
  return page.evaluate((k) => window.__bt.lotToScreen(k), key);
}
/** Skip to dusk, make the call, sit through the raid, sleep, and close the morning cards. */
async function night(page: Page, decision: "hold" | "walls" | "borrow", snap?: string): Promise<void> {
  await dev(page, "dev-dusk");
  await page.waitForFunction(() => ["dusk", "night"].includes(window.__bt.state().phase), null, { timeout: 20_000 });
  const raidCard = page.locator('.card.dusk [data-act="hold"], .card.dusk [data-act="walls"]');
  if (await raidCard.count()) {
    const card = page.locator(".card.dusk");
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expectOnScreen(page, ".card.dusk");
    if (snap) await shot(page, snap);
    await act(page, decision).click();
    await expect(page.locator(".card.held, .card.lost").first()).toBeVisible({ timeout: 30_000 });
    if (snap) await shot(page, `${snap}-result`);
    await act(page, "sleep").click();
    await page.waitForFunction(() => window.__bt.state().phase === "day", null, { timeout: 60_000 });
  } else {
    const skip = page.locator(".quiet-skip");
    if (await skip.count()) await skip.click({ timeout: 3000 }).catch(() => page.waitForTimeout(2600));
    else await page.waitForTimeout(2600);
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(400);
      const ok = page.locator('.card-wrap [data-act="ok"]');
      if (!(await ok.count())) break;
      await ok.first().click();
    }
    await page.waitForFunction(() => window.__bt.state().phase === "day", null, { timeout: 60_000 });
  }
  // seizure, season end, tier-up, morning and optional share cards until play resumes
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400);
    const wrap = page.locator(".card-wrap");
    if (!(await wrap.count())) break;
    const btn = wrap.locator('button:not([disabled])').first();
    if (!(await btn.count())) break;
    await btn.click();
  }
  await expect(page.locator(".card-wrap")).toHaveCount(0, { timeout: 20_000 });
}
/** Advance day by day until the next raid (or boss) night, then decide. */
async function nextRaid(page: Page, decision: "hold" | "walls" | "borrow", snap?: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const s = await st(page);
    if (s.day === 2 || s.day === 4 || s.day === 6) return night(page, decision, snap);
    await night(page, "hold");
  }
}

test("the arc: empty land to Village", async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await fresh(page);
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await shot(page, "01-home");

  // first run: "We're starving. Borrow 10 Hours?"
  await act(page, "new").click();
  await skipIntro(page);
  await expect(page.getByText("We're starving.")).toBeVisible();
  await expectOnScreen(page, ".card");
  await shot(page, "02-first-run");
  const h0 = (await st(page)).dayLen;
  await act(page, "borrow").click();
  let s = await st(page);
  expect(s.debt).toBe(10);
  expect(s.dayLen).toBeGreaterThan(h0); // borrowed light: today is longer
  await expect(page.locator('[data-hud="debt"]')).toContainText("Owed");
  await expect(page.locator(".coach-tip")).toContainText("Palisade");
  await shot(page, "03-empty-land");

  // the Palisade ring appears
  await act(page, "build").click();
  await expect(page.locator(".sheet")).toBeVisible();
  await shot(page, "04-build-sheet");
  // grouped by function, and nothing this era has not unlocked (no Roads in the Colony); the next era shows as one slim line
  await expect(page.locator(".sheet [data-group]").first()).toBeVisible();
  await expect(page.locator('.sheet [data-group="defence"] [data-build="palisade"]')).toHaveCount(1);
  await expect(page.locator('.sheet [data-build="road"]')).toHaveCount(0);
  await expect(page.locator(".sheet [data-next-era]")).toContainText("Village unlocks");
  await act(page, "build-palisade").click();
  expect((await st(page)).pal).not.toBeNull();
  await expect(page.locator(".coach-tip")).toContainText("Field");
  await act(page, "build").click();
  await act(page, "build-field").click();
  await expect(page.locator(".coach-tip")).toHaveCount(0);
  await shot(page, "05-ring-and-field");

  // tap a lot on the island (zoom in first when lots are smaller than a finger)
  await dev(page, "dev-hours");
  const free = await page.evaluate(() => Object.entries(window.__bt.state().lots).find(([k, v]) => !v && k !== "1,1" && Math.abs(+k.split(",")[0]) + Math.abs(+k.split(",")[1]) <= 2)![0]);
  const p = await lotPoint(page, free);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator(".sheet h2")).toHaveText("Build here");
  await act(page, "build-cottage").click();
  expect((await st(page)).lots[free]?.type).toBe("cottage");

  // upgrade from the building sheet
  const p2 = await lotPoint(page, free);
  await page.mouse.click(p2.x, p2.y);
  await expect(page.locator(".sheet h2")).toHaveText("Cottage");
  await act(page, "upgrade").click();
  expect((await st(page)).lots[free]?.n).toBe(1);
  await shot(page, "06-building-sheet");
  await act(page, "close").click();

  // Hesper: borrow shows today/tomorrow daylight; repay
  await act(page, "keeper").click();
  await expect(page.locator(".sheet.keeper")).toBeVisible();
  await shot(page, "07-hesper");
  await act(page, "repay-all").click();
  expect((await st(page)).debt).toBe(0);
  await expect(page.locator('[data-hud="debt"]')).toContainText("Safe");
  await act(page, "close").click();

  // a raid with each decision
  await nextRaid(page, "hold", "08-dusk-hold");
  await nextRaid(page, "walls");
  await nextRaid(page, "borrow", "09-long-dusk");
  s = await st(page);
  expect(s.stats.raidsWon + s.stats.raidsLost + s.stats.bossWon + s.stats.bossLost).toBeGreaterThanOrEqual(3);

  // food and homes for 36 people: three Fields, four Cottages, one of them upgraded
  await dev(page, "dev-hours");
  await dev(page, "dev-hours");
  for (const t of ["field", "field", "cottage", "cottage", "cottage", "tower", "tower"]) {
    await act(page, "build").click();
    await act(page, `build-${t}`).click();
  }
  // upgrade every Field and Cottage twice from its building sheet (food and homes for 36)
  const keys = await page.evaluate(() => Object.entries(window.__bt.state().lots).filter(([, v]) => ["field", "cottage"].includes((v as { type: string } | null)?.type ?? "")).map(([k]) => k));
  for (const k of keys) {
    const pc = await lotPoint(page, k);
    await page.mouse.click(pc.x, pc.y);
    for (let i = 0; i < 4; i++) if ((await act(page, "upgrade").count()) && (await act(page, "upgrade").isEnabled())) await act(page, "upgrade").click();
    await act(page, "close").click();
  }
  await act(page, "debug").click();
  await act(page, "close").click();
  await page.locator('[data-hud="charter"]').click();
  await expect(page.locator(".sheet")).toContainText("Food for");
  await act(page, "close").click();
  await shot(page, "11b-colony-built-up");

  // level-ups, people, a clean ledger: the Village charter
  await dev(page, "dev-level");
  await expect(page.locator(".toast.good")).toContainText("Level");
  await dev(page, "dev-level");
  await dev(page, "dev-people");
  await dev(page, "dev-people");
  await dev(page, "dev-debt");
  s = await st(page);
  expect(s.L).toBeGreaterThanOrEqual(3);
  await act(page, "keeper").click();
  await act(page, "close").click();
  // sleep until the morning check passes (people stay only if fed and housed)
  for (let i = 0; i < 24 && (await st(page)).tier === 0; i++) {
    await dev(page, "dev-debt");
    await night(page, "hold");
    // morning cards come one after another (the tier card last): wait until the screen is clear
    for (let k = 0; k < 12; k++) {
      await page.waitForTimeout(400);
      if (await page.locator(".card.tier").count()) break;
      const ok = page.locator('.card-wrap [data-act="ok"]');
      if (await ok.count()) await ok.first().click();
      else if (k > 2) break;
    }
    if (await page.locator(".card.tier").count()) break;
    await dev(page, "dev-people");
  }
  for (let t = 0; t < 40; t++) {
    if (await page.locator('.card.tier h2').filter({ hasText: "Village" }).count()) break;
    const skip = page.locator('.card-wrap [data-act="skip"]');
    if (await skip.count()) await skip.first().click();
    await page.waitForTimeout(500);
  }
  await expect(page.locator(".card.tier h2")).toHaveText("Village!", { timeout: 60_000 });
  await shot(page, "12-tier-up");
  await page.locator('.card.tier [data-act="ok"]').click();
  for (let i = 0; i < 3 && (await page.locator('.card-wrap [data-act="ok"]').count()); i++) await page.locator('.card-wrap [data-act="ok"]').first().click();
  s = await st(page);
  expect(s.tier).toBe(1);
  expect(Object.keys(s.lots)).toHaveLength(120); // 11×11 minus the gnomon
  await shot(page, "13-village");

  // a seizure: borrow to the limit and let a night's interest tip it over
  await dev(page, "dev-hours");
  await act(page, "build").click();
  await act(page, "build-workshop").click();
  await expect(page.locator(".sheet")).toHaveCount(0);
  await act(page, "keeper").click();
  const max = page.locator('[data-act^="borrow-"]').last();
  await max.click();
  await act(page, "close").click();
  await shot(page, "14-grey-land");
  await dev(page, "dev-dusk");
  await expect(page.locator(".card.dusk")).toBeVisible({ timeout: 20_000 });
  if (await page.locator('.card.dusk [data-act="sleep"]').count()) await act(page, "sleep").click();
  else {
    await act(page, "hold").click();
    await expect(page.locator(".card.held, .card.lost").first()).toBeVisible({ timeout: 30_000 });
    await act(page, "sleep").click();
  }
  await expect(page.getByText(/Hesper took your/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("“Gently, as always.”")).toBeVisible();
  await shot(page, "15-seizure");
  for (let i = 0; i < 4 && (await page.locator('.card-wrap [data-act="ok"]').count()); i++) await page.locator('.card-wrap [data-act="ok"]').first().click();
  expect((await st(page)).stats.seized).toBeGreaterThan(0);


  // the cues fired
  const cues = await page.evaluate(() => window.__bt.played());
  for (const c of ["build", "borrow", "upgrade", "dusk", "horn", "seize", "tierUp", "levelUp"]) expect(cues).toContain(c);

  // resume: reload, Continue, same island
  const before = JSON.stringify(await st(page));
  await page.reload();
  await page.waitForFunction(() => window.__bt?.ready === true);
  await act(page, "continue").click();
  expect(JSON.stringify(await st(page))).toBe(before);

  // settings
  await act(page, "pause").click();
  await act(page, "settings").click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
  await page.locator('[data-set="sound"]').click();
  await shot(page, "16-settings");
  await act(page, "back").click();
  expect(errors).toEqual([]);
});

test("resume mid-day keeps the hour", async ({ page }) => {
  await fresh(page);
  await act(page, "new").click();
  await skipIntro(page);
  await act(page, "no").click();
  await page.waitForFunction(() => window.__bt.state().hour >= 1, null, { timeout: 15_000 });
  const s0 = await st(page);
  await page.reload();
  await page.waitForFunction(() => window.__bt?.ready === true);
  await act(page, "continue").click();
  const s1 = await st(page);
  expect(s1.hour).toBeGreaterThanOrEqual(s0.hour);
  expect(s1.seed).toBe(s0.seed);
});

test("blocked storage: the game still plays and says saving is off", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__bt?.ready === true);
  await expect(page.getByText(/Saving is off/)).toBeVisible();
  await act(page, "new").click();
  await skipIntro(page);
  await act(page, "borrow").click();
  expect((await st(page)).debt).toBe(10);
});

test("a stale or corrupt save starts fresh instead of crashing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("bt.save", '{"v":99,"data":{}}'));
  await page.reload();
  await page.waitForFunction(() => window.__bt?.ready === true);
  await expect(act(page, "continue")).toHaveCount(0);
  await expect(act(page, "new")).toBeVisible();
});

test("tap targets are at least 44 px and nothing overlaps the HUD", async ({ page }) => {
  await fresh(page);
  await act(page, "new").click();
  await skipIntro(page);
  await act(page, "borrow").click();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#ui button")]
      .filter((b) => b.offsetParent)
      .map((b) => ({ id: b.dataset.act ?? b.textContent, r: b.getBoundingClientRect() }))
      .filter((x) => x.r.width < 43.5 || x.r.height < 43.5)
      .map((x) => `${x.id} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
  );
  expect(small).toEqual([]);
  const overlap = await page.evaluate(() => {
    const sels = ['[data-hud="hours"]', '[data-hud="debt"]', ".daybox", '[data-hud="charter"]', ".pause-btn", ".colony-badge", ".bar"];
    const rs = sels.map((s) => [s, document.querySelector(s)!.getBoundingClientRect()] as const);
    const hit = (p: DOMRect, q: DOMRect) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
    const out: string[] = [];
    for (let i = 0; i < rs.length; i++) {
      if (rs[i][1].right > innerWidth || rs[i][1].bottom > innerHeight) out.push(`${rs[i][0]} off screen`);
      for (let j = i + 1; j < rs.length; j++) if (hit(rs[i][1], rs[j][1])) out.push(`${rs[i][0]} x ${rs[j][0]}`);
    }
    return out;
  });
  expect(overlap).toEqual([]);
  // the HUD is one strip: the island keeps the rest of the screen
  const hudBottom = await page.evaluate(() => document.querySelector(".hud")!.getBoundingClientRect().bottom);
  expect(hudBottom).toBeLessThanOrEqual(88);
});

test("held upright with Landscape chosen, the browser asks to turn the phone sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("bt.settings", JSON.stringify({ sound: true, haptics: true, quality: "auto", orientation: "landscape" }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__bt?.ready === true);
  await expect(page.getByText("Turn your phone sideways to play.")).toBeVisible();
});

test("portrait setting: a fresh install defaults to Auto, so held upright it just plays", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await fresh(page);
  await expect(page.getByText("Turn your phone sideways to play.")).toBeHidden();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.orient)).toBe("auto");
  await act(page, "settings").click();
  await expect(page.locator('select[data-set="orientation"]')).toHaveValue("auto");
  await expect(page.locator("[data-credits]")).toContainText("Ribhav Agrawal");
  await expect(page.locator("[data-credits]")).toContainText("Bryan Jesus De Los Santos Breton");
});

test("portrait setting: home and new game at 360x800", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("bt.settings", JSON.stringify({ sound: true, haptics: true, quality: "auto", orientation: "portrait" }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__bt?.ready === true);
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await act(page, "new").click();
  await skipIntro(page);
  await expect(page.getByText("We're starving.")).toBeVisible();
});
