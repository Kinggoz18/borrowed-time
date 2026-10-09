// Borrowed Time v2 balance sim. Evaluates the exact rules from prototype.html (between CORE-START/CORE-END).
// Usage: node sim-test.js   (env RUNS, SEAS, CORE=path override, RULES=build|proto)
// RULES=build (default) applies the build-rule changes from FINAL_PLAN.md / DESIGN_V2.md on top of the prototype core
// (no prototype rebuild): growth gate = level + people + not over the credit limit, and the income curve below.
// RULES=proto runs the prototype exactly as shipped.
const fs = require('fs'), path = require('path'); const src = process.env.CORE || path.join(__dirname, 'prototype.html');
let SRC = fs.readFileSync(src, 'utf8'); if (src.endsWith('.html')) SRC = SRC.slice(SRC.indexOf('/*CORE-START*/'), SRC.indexOf('/*CORE-END*/'));
const RULES = process.env.RULES || 'build';
const BUILD_PATCHES = [ // [prototype text, build text]: each must match exactly once
  // growth: the kept years overflow when the colony has lived enough (level) and is big enough (people); lent hours are not kept
  ['nx && ev.seasonEnd && ev.seasonEnd.won && ev.seasonEnd.clean && st.L >= nx.lvl && st.pop >= nx.pop', 'nx && st.L >= nx.lvl && st.pop >= nx.pop && ' + ({ limit: 'st.debt <= limit(st)', hours: 'st.debt <= st.hours', half: 'st.debt <= 0.5 * limit(st)', lien: 'st.debt <= limit(st) && !st.seizedSeason', kept: 'st.debt <= limit(st) && st.keptYear !== false', seal: 'st.debt <= limit(st) && (st.lien || 0) <= st.season * SEASON_DAYS + st.day', both: 'st.debt <= limit(st) && st.keptYear !== false && (st.lien || 0) <= st.season * SEASON_DAYS + st.day' })[process.env.GATE || 'seal']],
  // salvage: repelled raiders leave the hours they carried on the beach; in borrowed light we find more of it
  ["if (ev.won) { ev.loot = Math.round(0.12 * income(st) + 2);", "if (ev.won) { ev.loot = Math.round((0.12 * income(st) + SALV * S + 2) * (decision === 'borrow' ? 1.5 : 1));"],
  // bigger works keep more of the year: an upgrade gives 1 XP plus its look stage (XPU=0 turns this off)
  ["b.n++; gainXP(st, 1);", "b.n++; gainXP(st, 1 + Math.round(XPU * stageOf(b.n)));"],
  // grey-land homes house half (sumEff already halves them); people won't sleep where the hours have gone, so the homeless leave at dawn like the hungry do
  ["if (st.pop > Math.floor(food(st)) && st.pop > 1) { ev.left = Math.min(st.pop - 1, Math.max(1, Math.ceil((st.pop - food(st)) / 2))); st.pop -= ev.left; }",
   "const keepN = Math.min(Math.floor(food(st)), popRoom(st)); if (st.pop > keepN && st.pop > 1) { ev.left = Math.min(st.pop - 1, Math.max(1, Math.ceil((st.pop - keepN) / 2))); st.pop -= ev.left; }"],
  // the frames still stand: the Late take hours, not timber, so a level knocked off by a raid is rebuilt at half price
  ["} else { b.n--; b.inv *= 0.9;", "} else { b.n--; b.inv *= 0.9; b.lost = (b.lost || 0) + 1;"],
  ["b.inv += pay(st, type, b.n + 1);", "const paid = pay(st, type, b.n + 1); b.inv += paid; if (b.lost > 0) { b.lost--; const back = Math.floor(paid * REBUILD); if (B[type].credit) st.debt -= back; else st.hours += back; b.inv -= back; }"],
  // foreclosure: people won't stay where Hesper collects. A seizure sends a share of the colony back to sea
  ["st.stats.seized++;", "st.stats.seized++; ev.fled = Math.min(st.pop - 1, Math.ceil(FLEE * st.pop)); st.pop -= ev.fled; st.lien = st.season * SEASON_DAYS + st.day + LIEN_DAYS;"],
];
if (RULES === 'build') for (const [a, b] of BUILD_PATCHES) { const n = SRC.split(a).length - 1; if (n !== 1) throw new Error('build patch matched ' + n + 'x: ' + a.slice(0, 60)); SRC = SRC.replace(a, b); }
var FLEE = +(process.env.FLEE || 0), REBUILD = +(process.env.REBUILD || 0.5), LIEN_DAYS = +(process.env.LIEN || 12), XPU = +(process.env.XPU || 1);
eval(SRC.replace(/^const /gm, 'var '));
// ---- build income curve (lore: walls keep time; each age keeps more of it) ----
const KEEP = (process.env.KEEP || '0.25,0.2').split(',').map(Number);   // every building keeps KEEP[0] + KEEP[1]·n Hours a day
const ERA_K = (process.env.ERA || '1,1,1,1').split(',').map(Number); // building income per age (Colony, Village, Town, City)
var SALV = RULES === 'build' ? +(process.env.SALV || 0.3) : 0; // salvage per point of raider strength (build only)
// raids keep their spikes but can't outrun the economy: an ordinary raid grows at most 25% faster than income since the same raid last season
if (RULES === 'build') { const nom0 = nominal, res0 = resolveDusk;
  nominal = (st, day = st.day) => { let n = nom0(st, day); const m = st.raidMem && st.raidMem[day]; if (DAY_KIND[day] === 'raid' && m && m.tier === st.tier) n = Math.min(n, Math.round(m.n * 1.25 * Math.max(1, income(st) / m.inc))); return n; };
  resolveDusk = (st, dec, rnd) => { const day = st.day, n = DAY_KIND[day] === 'raid' ? nominal(st) : 0, inc = income(st), ev = res0(st, dec, rnd); if (n) (st.raidMem = st.raidMem || {})[day] = { n, inc, tier: st.tier };
    if (DAY_KIND[day] === 'boss') st.keptYear = !!ev.won; // a year is kept only if its Long Dusk is held
    // defended-night reward: a held night leaves a Late boat on our beach; it moors at the docks and fishes (small, diminishing: the fleet adds at most BOAT_TOP income)
    if (ev.won) { const i0 = income(st); st.boats = (st.boats || 0) + 1; ev.boat = true; if (TRACK) TRACK.push({ t: CLOCK + 1, tier: st.tier, gain: income(st) / i0 - 1, inc: income(st), look: true }); }
    return ev; }; }
const BOAT_TOP = +(process.env.BOAT_TOP || 0.08);
if (RULES === 'build') { for (const t in B) if (!GLOB[t]) B[t].keep = n => KEEP[0] + KEEP[1] * n;
  TIERS[3].threat = +(process.env.CITY_THREAT || 1.12);
  (process.env.TLVL || '1,3,7,11').split(',').map(Number).forEach((l, t) => { TIERS[t].lvl = l; }); // level needed per tier // City raid scale retuned for the build income curve
  income = st => (4 + peopleInc(st) + (sumEff(st, 'inc') + sumEff(st, 'keep')) * roadMul(st) * ERA_K[st.tier]) * (st.tech && st.tech.looms ? 1.1 : 1) * (1 + dialBonus(st) + BOAT_TOP * (1 - Math.exp(-(st.boats || 0) / 25))); }
// ---- the Great Dial (City): the city builds its own dial, stage by stage, so it can keep time without Hesper ----
// open-ended: no last stage; each stage is visible (a ring, a gear, a lamp) and gives XP like an upgrade; income bonus diminishes (max +25%). Paid in your own Hours only.
const dialBonus = st => DIAL_TOP * (1 - Math.exp(-(st.dial || 0) / 30)); // diminishing: the whole dial adds at most DIAL_TOP
const DIAL_TOP = +(process.env.DIAL_TOP || 0.25), DIAL_BASE = +(process.env.DIAL_BASE || 20), DIAL_INC = DIAL_TOP / 30, DIAL_MAX = +(process.env.DIAL_MAX || 1e9), DIAL_G = +(process.env.DIAL_G || 0.03);
const dialCost = st => Math.round(DIAL_BASE * (1 + DIAL_G * (st.dial || 0)) * costMul(st.L));
function buildDial(st) { if (RULES !== 'build' || st.tier < 3 || (st.dial || 0) >= DIAL_MAX || st.hours < dialCost(st)) return false; const i0 = income(st); st.hours -= dialCost(st); st.dial = (st.dial || 0) + 1; gainXP(st, 1 + Math.round(XPU * Math.min(6, Math.floor(st.dial / 3))));
  if (TRACK) TRACK.push({ t: CLOCK + st.hour / st.dayLen, tier: st.tier, gain: income(st) / i0 - 1, inc: income(st), look: true }); return true; }
// ---- pacing tracker: every income-raising action, timed in in-game days ----
let TRACK = null, CLOCK = 0;
const wrap = (fn, isBuild) => function (st, k, ...a) { const i0 = income(st), s0 = isBuild ? -1 : stageOf(lvOf2(st, k)), r = fn(st, k, ...a); if (r && TRACK) { const i1 = income(st); TRACK.push({ t: CLOCK + st.hour / st.dayLen, tier: st.tier, gain: (i1 - i0) / i0, inc: i1, look: isBuild || stageOf(lvOf2(st, k)) !== s0 }); } return r; };
const lvOf2 = (st, k) => { const b = bAt(st, k); return b ? b.n : 0; };
build = wrap(build, true); upgrade = wrap(upgrade, false);
const STRATS = {
  never:     { tut: false, d1: 0,    daily: 0,    repayFrom: 99, credit: 0,   dusk: 'walls' },
  balanced:  { tut: true,  d1: 0.25, daily: 0,    repayFrom: 2,  credit: 0.5, dusk: 'smart' },
  leverage:  { tut: true,  d1: 0.6,  daily: 0,    repayFrom: 3,  credit: 0.8, dusk: 'smart' },
  borrowMax: { tut: true,  d1: 1.0,  daily: 0,    repayFrom: 4,  credit: 1,   dusk: 'borrow' },
  reckless:  { tut: true,  d1: 0,    daily: 0.25, repayFrom: 99, credit: 1,   dusk: 'borrow' },
};
function freeLot(st) { const keys = greyOrder(st).slice().reverse(); return keys.find(k => isFree(st, k)); } // safest land first
const T_ORDER = ['field', 'cottage', 'workshop', 'tower', 'bank', 'lantern', 'mirror'];
function bestOf(st, list) { for (const o of list) if (o()) return true; return false; }
function upgradeCheapest(st, type) { const c = blds(st).filter(([k, b]) => b.type === type && canUpgrade(st, k)).sort((a, b) => a[1].n - b[1].n); return c.length ? upgrade(st, c[0][0]) : false; }
function tryDefence(st) { const f = freeLot(st), opts = [];
  if (!st.pal) opts.push({ c: cost('palisade', 0, st.L), d: B.palisade.def(0), go: () => build(st, 'pal', 'palisade') });
  else if (st.pal.n < tierCap(st)) opts.push({ c: cost('palisade', st.pal.n + 1, st.L), d: 3, go: () => upgrade(st, 'pal') });
  blds(st).forEach(([k, b]) => { if (b.type === 'tower' && b.n < tierCap(st)) opts.push({ c: cost('tower', b.n + 1, st.L), d: 2.5, go: () => upgrade(st, k) }); });
  if (f) opts.push({ c: cost('tower', 0, st.L), d: 5, go: () => build(st, f, 'tower') });
  opts.sort((a, b) => a.c / a.d - b.c / b.d); for (const o of opts) if (st.hours >= o.c && o.go()) return true; return false; }
function tryEconomy(st, rnd) { const f = freeLot(st), want = t => f && build(st, f, t);
  const opts = [];
  const room = popRoom(st), cap = TIERS[st.tier].popCap; // people scale: keep food a step ahead of homes, homes a step ahead of people
  if (Math.floor(food(st)) <= Math.max(st.pop, room - 1) && Math.floor(food(st)) < cap) opts.push(() => want('field'), () => upgradeCheapest(st, 'field'));
  if (room <= st.pop + 2 && room < cap) opts.push(() => want('cottage'), () => upgradeCheapest(st, 'cottage'));
  if (st.debt > 0.3 * limit(st)) opts.push(() => want('bank'));
  opts.push(() => want('workshop'), () => upgradeCheapest(st, 'workshop'));
  if (rnd() < 0.25) opts.reverse();
  if (RULES === 'build' && st.tier >= 3 && st.hours - dialCost(st) > 4 && buildDial(st)) return true; // the City's long project comes first once the day's needs are met
  if (bestOf(st, opts)) return true;
  // spare Hours: cheapest useful upgrade of anything
  const ups = []; blds(st).forEach(([k, b]) => { if (canUpgrade(st, k) && !B[b.type].credit) ups.push([cost(b.type, b.n + 1, st.L), k]); }); if (st.pal && canUpgrade(st, 'pal')) ups.push([cost('palisade', st.pal.n + 1, st.L), 'pal']);
  ['field', 'cottage', 'tower', 'workshop'].forEach(t => { if (f && canBuild(st, f, t)) ups.push([cost(t, 0, st.L), 'new:' + t]); });
  if (RULES === 'build' && st.tier >= 3 && (st.dial || 0) < DIAL_MAX) ups.push([dialCost(st), 'dial']);
  if (RULES === 'build') { const I = income(st); ups.forEach(u => { const [c, k] = u; let d;
      if (k === 'dial') d = (DIAL_INC + 0.01) * I; else if (k.startsWith('new:')) d = 0.01 * I; else { const b = bAt(st, k), e = B[typeAt(st, k)]; d = (e.inc ? e.inc(b.n + 1) - e.inc(b.n) : 0) + (e.keep ? e.keep(b.n + 1) - e.keep(b.n) : 0); if (stageOf(b.n + 1) !== stageOf(b.n)) d += 0.01 * I; }
      u.push(d / c); }); ups.sort((a, b) => b[2] - a[2] || a[0] - b[0]); } else ups.sort((a, b) => a[0] - b[0]);
  for (const [c, k] of ups) if (st.hours - c > 4) { if (k === 'dial' ? buildDial(st) : k.startsWith('new:') ? build(st, f, k.slice(4)) : upgrade(st, k)) return true; }
  return false; }
function tryCredit(st, P) { if (!P.credit) return false; const f = freeLot(st);
  for (const t of ['lantern', 'mirror']) { if (B[t].tier > st.tier) continue; const c = cost(t, 0, st.L); if (!hasB(st, t) && f && st.debt + c <= P.credit * limit(st)) return build(st, f, t);
    const k = blds(st).find(([, b]) => b.type === t); if (k && k[1].n < tierCap(st) && st.debt + cost(t, k[1].n + 1, st.L) <= P.credit * limit(st) * 0.6) return upgrade(st, k[0]); }
  return false; }
// tier unlocks: every strategy uses them; borrowers may borrow to fund research or a caravan when the price is good
const UNLOCKS = ['road', 'trade', 'hospital', 'academy', 'harbour', 'exchange', 'observatory'];
function trySystems(st, P, rnd, late) { const f = freeLot(st), room = () => P.credit ? P.credit * limit(st) - st.debt : 0;
  for (const t of UNLOCKS) { if (B[t].tier > st.tier || countOf(st, t)) continue; const c = cost(t, 0, st.L); if (st.hours - c > 4 && (B[t].glob || f) && build(st, B[t].glob ? B[t].glob : f, t)) return true; }
  if (hasB(st, 'academy') && !st.researching) for (const id of ['ledgers', 'looms', 'rotation', 'crossbows']) { if (st.tech[id]) continue; const c = techCost(st, id);
    if (st.hours - c < 4 && P.credit >= 0.8 && room() > c) borrow(st, c - st.hours + 4); if (st.hours - c >= 4 && research(st, id)) return true; break; }
  if (!late && tradeCap(st) > st.caravan && st.price >= 1.25) { const want = tradeCap(st) - st.caravan;
    if (P.credit >= 0.8 && st.price >= 1.35 && room() > 0) borrow(st, Math.min(want, room()) * 0.5);
    if (st.hours - 8 > 0 && sendCaravan(st, Math.min(want, st.hours - 8))) return true; }
  return false; }
function playDay(st, P, rnd, first) {
  if (first && P.tut) borrow(st, 10);
  if (st.day === 1 && P.d1) borrow(st, P.d1 * limit(st) - st.debt);
  if (P.daily && st.day < SEASON_DAYS) borrow(st, P.daily * limit(st));
  while (st.phase === 'day') {
    const kind = DAY_KIND[st.day], r = raidRange(st), T = r ? r[1] : 0, late = st.hour >= st.dayLen - 4, boss = kind === 'boss';
    for (let n = 0; n < 12; n++) {
      if (boss && st.debt > 0 && P.repayFrom < 99 && st.hours >= 1) { repay(st, st.hours); continue; }
      if (T && defence(st) < T && (late || boss)) { if (tryDefence(st)) continue; }
      if (st.day >= P.repayFrom && st.debt > 0 && st.hours > 3 && (!T || defence(st) >= T)) { repay(st, st.hours - 2); continue; }
      if (tryCredit(st, P)) continue;
      if (trySystems(st, P, rnd, late)) continue;
      if (!late) { if (tryEconomy(st, rnd)) continue; }
      const nk = raidRange(st, st.day + 1); if (late && nk && defence(st) < nk[1] && (!T || defence(st) >= T)) { if (tryDefence(st)) continue; }
      break; }
    const e = tickHour(st);
    if (e) { const r2 = raidRange(st), D = defence(st); let dec = 'hold';
      if (e.kind !== 'quiet') { if (P.dusk === 'borrow') dec = canBorrowDusk(st) ? 'borrow' : 'walls';
        else if (P.dusk === 'smart') dec = D >= r2[1] ? 'hold' : (canBorrowDusk(st) && D * 1.3 >= r2[0] ? 'borrow' : 'walls');
        else dec = D >= r2[1] ? 'hold' : 'walls'; }
      resolveDusk(st, dec, rnd); return night(st); } }
}
function playSeason(st, P, rnd, firstSeason) { const s0 = st.season; let first = firstSeason, res = null; while (st.season === s0) { const n = playDay(st, P, rnd, first); first = false; if (n && n.seasonEnd) res = n.seasonEnd; } return res; }
function clone(st, seed) { const c = JSON.parse(JSON.stringify({ ...st, rng: null })); c.rng = makeRng(seed); return c; }
// snapshots: a balanced campaign reaches each tier; we take the start of the following season (debt cleared)
function snapshots() { const snaps = []; for (let s = 1; snaps.length < 4 * 4 && s < 40; s++) { const st = newGame({ seed: s }), rnd = makeRng(s * 7), got = {}; got[0] = clone(st, 1);
    for (let k = 0; k < 60 && Object.keys(got).length < 4; k++) { playSeason(st, STRATS.balanced, rnd, k === 0); if (!got[st.tier]) got[st.tier] = clone(st, 1); }
    for (const t in got) { const c = got[t]; c.debt = 0; c.hours = Math.max(c.hours, 8); snaps.push({ tier: +t, st: c }); } } return snaps; }
module.exports = { STRATS, playSeason, playDay, clone, snapshots };
// ---- campaign mode: each strategy plays its own colony from empty land; stats are grouped by the tier a season was played in
function campaign(name, seed, seasons) { const st = newGame({ seed }), rnd = makeRng(seed * 7 + 3), P = STRATS[name], out = { seasons: [], lvlDay: { 1: 0 }, lvlInc: { 1: income(st) }, tierDay: { 0: 0 }, days: [], acts: [] }; TRACK = out.acts;
  for (let k = 0; k < seasons; k++) { const t0 = st.tier, w0 = netWorth(st) / costMul(st.L), z0 = st.stats.seized, dayAbs0 = k * SEASON_DAYS;
    const s0 = st.season; let first = k === 0, res = null, d = 0;
    while (st.season === s0) { const L0 = st.L, T0 = st.tier; CLOCK = dayAbs0 + d; out.days.push({ t: CLOCK, tier: st.tier, inc: income(st), h: st.hours, debt: st.debt, lim: limit(st), L: st.L, pop: st.pop, day: st.day, seized: st.stats.seized }); const n = playDay(st, P, rnd, first); first = false; d++; if (n && n.seasonEnd) res = n.seasonEnd;
      for (let l = L0 + 1; l <= st.L; l++) { out.lvlDay[l] = dayAbs0 + d; out.lvlInc[l] = income(st); } for (let t = T0 + 1; t <= st.tier; t++) out.tierDay[t] = dayAbs0 + d; }
    out.seasons.push({ tier: t0, won: !!(res && res.won), growth: netWorth(st) / costMul(st.L) - w0, seized: st.stats.seized - z0, debt: st.debt / limit(st) }); }
  TRACK = null; return out; }
module.exports.campaign = campaign;
// ---- pacing: income growth per season-long window, and gaps between meaningful advancements ----
// meaningful = a new building, a new look (every 3 levels), a level-up, a tier-up, or income up 1% since the last one (any source)
const MEANINGFUL = 0.01;
function pacing(c) { return [0, 1, 2, 3].map(t => { const ds = c.days.filter(d => d.tier === t); if (ds.length < 7) return null;
  const win = []; for (let i = SEASON_DAYS; i < ds.length; i++) win.push(ds[i].inc / ds[i - SEASON_DAYS].inc - 1);
  const t0 = ds[0].t, t1 = ds[ds.length - 1].t + 1, ev = [];
  // income is sampled after every action and at every dawn (new settlers, healed people and caravans raise it too)
  const tl = c.acts.filter(a => a.tier === t).map(a => ({ t: a.t, inc: a.inc, look: a.look })).concat(ds.map(d => ({ t: d.t, inc: d.inc }))).sort((x, y) => x.t - y.t);
  let base = ds[0].inc; tl.forEach(p => { if (p.look || p.inc >= base * (1 + MEANINGFUL)) { ev.push(p.t); base = p.inc; } });
  Object.values(c.lvlDay).forEach(x => { if (x > t0 && x <= t1) ev.push(x); }); ev.sort((x, y) => x - y);
  const pts = [t0, ...ev], gaps = [], at = []; for (let i = 1; i < pts.length; i++) { gaps.push(pts[i] - pts[i - 1]); at.push(pts[i - 1]); }
  const last = t === 3 ? 0 : t1 - pts[pts.length - 1]; if (last) { gaps.push(last); at.push(pts[pts.length - 1]); } // the open gap before the next tier counts; the campaign's end does not
  return { win, gaps, at, days: ds.length, entry: ds[0].inc, exit: ds[ds.length - 1].inc }; }); }
module.exports.pacing = pacing;

// ---- the checks ----
const FLOOR = (process.env.FLOOR || '0.1,0.03,0.01,0.005').split(',').map(Number), MAX_GAP = +(process.env.MAX_GAP || 2); // pacing gates, starting targets
const BANDS = [[65, 95], [55, 85], [45, 75], [35, 65]]; // target boss win-rate band per tier for a competent player (mean of never / balanced / leverage)
if (require.main === module) {
  const RUNS = +(process.env.RUNS || 24), SEAS = +(process.env.SEAS || 45), res = {}, lv = {}, inc = {}; const pace = [0, 1, 2, 3].map(() => ({ win: [], gaps: [] }));
  for (const name in STRATS) { const agg = [0, 1, 2, 3].map(() => ({ n: 0, w: 0, g: 0, z: 0 })), reached = [0, 0, 0, 0];
    for (let r = 1; r <= RUNS; r++) { const c = campaign(name, r, SEAS); if (name === 'balanced') pacing(c).forEach((p, t) => { if (p) { pace[t].win.push(...p.win); pace[t].gaps.push(...p.gaps); } }); c.seasons.forEach(s => { const a = agg[s.tier]; a.n++; a.w += s.won; a.g += s.growth; a.z += s.seized; });
      for (const t in c.tierDay) reached[t]++; if (name === 'balanced') for (const l in c.lvlDay) { (lv[l] = lv[l] || []).push(c.lvlDay[l]); (inc[l] = inc[l] || []).push(c.lvlInc[l]); } }
    res[name] = agg.map((a, t) => ({ n: a.n, win: a.n ? 100 * a.w / a.n : null, growth: a.n ? a.g / a.n : null, seized: a.n ? a.z / a.n : null, reached: reached[t] })); }
  const rows = []; for (let t = 0; t < 4; t++) for (const name in STRATS) { const r = res[name][t]; rows.push({ tier: TIERS[t].name, strategy: name, seasons: r.n, 'reached tier': `${r.reached}/${RUNS}`, 'boss won': r.n ? Math.round(r.win) + '%' : '-', 'growth/season': r.n ? Math.round(r.growth) : '-', 'seized/season': r.n ? r.seized.toFixed(2) : '-' }); }
  console.log(`Campaigns: ${RUNS} colonies x ${SEAS} seasons per strategy (${RUNS * SEAS} seasons each), from empty land.`); console.table(rows);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, maxL = Math.max(...Object.keys(lv).filter(l => lv[l].length >= RUNS * 0.8).map(Number));
  const lvRows = []; for (let l = 1; l < maxL; l++) lvRows.push({ level: l, 'cost x': costMul(l).toFixed(2), 'Clockworks build': cost('workshop', 0, l), 'income/day': Math.round(mean(inc[l])), 'days to next': +(mean(lv[l + 1]) - mean(lv[l])).toFixed(1), 'reached on day': Math.round(mean(lv[l])) });
  console.log('Balanced campaign, by player level:'); console.table(lvRows);
  let ok = true; const say = (pass, msg) => { console.log((pass ? 'PASS ' : 'FAIL ') + msg); if (!pass) ok = false; };
  for (let t = 0; t < 4; t++) { const sane = ['never', 'balanced', 'leverage'].map(n => res[n][t]).filter(r => r.n);
    const avg = mean(sane.map(r => r.win)); say(avg >= BANDS[t][0] && avg <= BANDS[t][1], `${TIERS[t].name}: competent boss win ${Math.round(avg)}% within ${BANDS[t][0]}-${BANDS[t][1]}%`);
    const live = Object.keys(STRATS).filter(n => res[n][t].n >= 20), bw = Math.max(...live.map(n => res[n][t].win)), bg = Math.max(...live.map(n => res[n][t].growth));
    const dom = live.filter(n => res[n][t].win === bw && res[n][t].growth === bg); say(!dom.length, `${TIERS[t].name}: no strategy is best at both boss wins and growth${dom.length ? ' (' + dom + ')' : ''}`);
    const nv = res.never[t], bb = ['balanced', 'leverage'].map(n => res[n][t]).filter(r => r.n); const dg = Math.max(...bb.map(r => Math.abs(r.growth - nv.growth) / Math.abs(nv.growth))), dw = Math.max(...bb.map(r => Math.abs(r.win - nv.win)));
    say(dg >= 0.1 || dw >= 8, `${TIERS[t].name}: borrowing changes the outcome (growth ${Math.round(dg * 100)}%, boss wins ${Math.round(dw)} pts vs never)`); }
  for (const n of ['borrowMax', 'reckless']) { const r = res[n], live = r.filter(x => x.n); const lose = live.every(x => x.win < 25 || x.growth <= 0) && r[1].reached < RUNS * 0.5; say(lose, `${n} loses (stuck: reached Village ${r[1].reached}/${RUNS}; boss wins ${live.map(x => Math.round(x.win) + '%').join('/')})`); }
  const steps = lvRows.map(r => r['days to next']); let smooth = true, worst = ''; for (let i = 2; i < steps.length; i++) { const q = steps[i] / steps[i - 1]; if (q > 2.2 || q < 0.5) { smooth = false; worst += ` L${i + 1}:${q.toFixed(2)}`; } }
  say(smooth, `time-to-next-level grows smoothly (each step 0.5-2.2x the previous)${worst}`);
  // pacing (starting targets): income keeps rising inside every tier, and a competent player never waits long for the next advancement
  const pq = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
  for (let t = 0; t < 4; t++) { const P = pace[t]; if (!P.win.length) continue; const g5 = pq(P.win, 0.05), mx = Math.max(...P.gaps);
    say(g5 >= FLOOR[t], `${TIERS[t].name}: income keeps rising (6-day growth p5 ${(g5 * 100).toFixed(1)}% >= ${FLOOR[t] * 100}%, median ${(pq(P.win, 0.5) * 100).toFixed(1)}%)`);
    say(mx <= MAX_GAP, `${TIERS[t].name}: never more than ${MAX_GAP} days without an advancement (longest ${mx.toFixed(1)}, p90 ${pq(P.gaps, 0.9).toFixed(1)})`); }
  console.log(ok ? 'ALL CHECKS PASS' : 'SOME CHECKS FAIL'); process.exitCode = ok ? 0 : 1;
}
