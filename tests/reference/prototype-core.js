// Vendored, unmodified: the rules block (CORE-START..CORE-END) of the v2 prototype.html. Reference for tests/parity.test.ts only.
/*CORE-START*/
// ===== Borrowed Time v2: pure rules (shared by the game and sim-test.js) =====
function makeRng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const SEASON_DAYS = 6, BASE_DAY = 12, MAX_LEVEL = 20, MIN_DAY = 7;
const DAY_KIND = { 2: 'raid', 4: 'raid', 6: 'boss' };
// pop = people needed to reach the tier; popCap = most people the tier can hold (41 founders arrive over the first days)
const TIERS = [
// lim = loan-limit scale, threat = raider scale (bigger settlements hold more and draw bigger fleets)
  { name: 'Colony', lvl: 1, pop: 0, grid: 7, cap: 5, popCap: 41, lim: 1.2, threat: 1 },
  { name: 'Village', lvl: 4, pop: 36, grid: 11, cap: 11, popCap: 160, lim: 1.25, threat: 0.95 },
  { name: 'Town', lvl: 8, pop: 120, grid: 15, cap: 17, popCap: 500, lim: 2, threat: 1.08 },
  { name: 'City', lvl: 12, pop: 380, grid: 21, cap: 20, popCap: 1600, lim: 2.8, threat: 1.22 }];
// people: crowds pay in and stand on the walls, with diminishing returns (square root of the fed)
const PEOPLE_INC = 1.5, PEOPLE_DEF = 0.6, BASE_FOOD = 8, BASE_HOUSE = 6;
const peopleInc = st => PEOPLE_INC * Math.sqrt(fed(st)), peopleDef = st => PEOPLE_DEF * Math.sqrt(fed(st));
// cost multiplier: a Hill (sigmoid, "denaturation") curve plus a slow linear tail, so the peak keeps rising, more slowly
const costMul = L => 1 + 2.4 * L * L / (L * L + 64) + 0.05 * L;
// raider power grows a little faster early, then tracks the economy
const xpNeed = L => Math.round(30 * Math.pow(L, 1.35));
const B = {
  field:    { name: 'Field',       base: 6,  desc: n => `Feeds ${fmt(10 + 7 * n)}`,             food: n => 10 + 7 * n },
  cottage:  { name: 'Cottage',     base: 7,  desc: n => `Houses ${fmt(6 + 2 * n)}`,           house: n => 6 + 2 * n },
  workshop: { name: 'Clockworks',  base: 10, desc: n => `+${fmt(4 + 2 * n)} Hours a day`,       inc: n => 4 + 2 * n },
  tower:    { name: 'Watchtower',  base: 9,  desc: n => `+${fmt(5 + 2.5 * n)} defence`,         def: n => 5 + 2.5 * n },
  bank:     { name: 'Hourglass',   base: 8,  desc: n => `Halves interest · +${fmt(1 + 0.5 * n)} Hours`, inc: n => 1 + 0.5 * n, one: true },
  lantern:  { name: 'Lantern Hall', base: 26, desc: n => `+${fmt(10 + 3 * n)} Hours, houses ${fmt(20 + 6 * n)}`, inc: n => 10 + 3 * n, house: n => 20 + 6 * n, one: true, credit: true, tier: 1 },
  mirror:   { name: 'Sun Mirror',  base: 34, desc: n => `+1 hour of daylight, +${fmt(5 + 2 * n)} Hours`, inc: n => 5 + 2 * n, one: true, credit: true, tier: 2 },
  palisade: { name: 'Palisade',    base: 8,  desc: n => `Ring wall: +${fmt(6 + 3 * n)} defence`, def: n => 6 + 3 * n, one: true, ring: true },
  // ---- tier unlocks: each is one building with one clear effect, and each one touches borrowing ----
  road:     { name: 'Roads',       base: 12, desc: n => `+${5 + n}% Hours from buildings · but raiders run them to grey land (+1 hit)`, one: true, glob: 'road', tier: 1 },
  trade:    { name: 'Trade Post',  base: 14, desc: n => `Caravans: stake up to ${fmt(10 + 3 * n)}h x cost, paid back x tomorrow\u2019s price · +${fmt(1 + 0.5 * n)} Hours`, inc: n => 1 + 0.5 * n, one: true, tier: 1 },
  academy:  { name: 'Academy',     base: 20, desc: n => `Research (costs Hours, done by morning) · +${fmt(2 + n)} Hours`, inc: n => 2 + n, one: true, tier: 2 },
  hospital: { name: 'Hospital',    base: 16, desc: n => `Saves ${40 + 2 * n}% of people lost in raids · grey land takes 1 hit less`, one: true, tier: 2 },
  exchange: { name: 'Exchange',    base: 30, desc: n => `Refinance: interest -${30 + n}% · credit limit +${15 + n}%`, one: true, tier: 3 },
  harbour:  { name: 'Harbour',     base: 26, desc: n => `Navy: +${fmt(8 + 3 * n)} defence · borrowing the dusk gives +50%`, def: n => 8 + 3 * n, one: true, tier: 3 },
  observatory: { name: 'Observatory', base: 30, desc: n => `Reads the Long Dusk: exact forecast · it feeds on ${40 + n}% less debt`, one: true, tier: 3 },
};
const GLOB = { palisade: 'pal', road: 'road' }; // settlement-wide upgrades: no lot of their own
const TECH = { ledgers: { name: 'Ledgers', base: 40, text: 'Interest -20%' }, rotation: { name: 'Crop rotation', base: 40, text: 'Food +15%' },
  crossbows: { name: 'Crossbows', base: 50, text: 'Defence +12%' }, looms: { name: 'Clockwork looms', base: 50, text: 'Hours +10%' } };
const lvOf = (st, t) => { if (GLOB[t]) return st[GLOB[t]] ? st[GLOB[t]].n : -1; let m = -1; for (const k in st.lots) { const b = st.lots[k]; if (b && b.type === t && b.n > m) m = b.n; } return m; };
const techCost = (st, id) => Math.round(TECH[id].base * costMul(st.L) * (1 - 0.02 * Math.max(0, lvOf(st, 'academy'))));
function research(st, id) { if (!hasB(st, 'academy') || st.tech[id] || st.researching || st.hours < techCost(st, id)) return false; st.hours -= techCost(st, id); st.researching = id; return true; }
const tradeCap = st => hasB(st, 'trade') ? Math.round((10 + 3 * lvOf(st, 'trade')) * costMul(st.L) * TIERS[st.tier].lim) : 0;
function sendCaravan(st, x) { x = Math.min(Math.floor(x), Math.floor(st.hours), tradeCap(st) - st.caravan); if (x <= 0) return 0; st.hours -= x; st.caravan += x; return x; }
// how many of each building a settlement tier allows (Colony, Village, Town, City)
const COUNT = { field: [3, 5, 8, 12], cottage: [4, 10, 20, 40], workshop: [2, 4, 7, 10], tower: [2, 4, 7, 10], bank: [1, 1, 1, 1], lantern: [0, 1, 1, 1], mirror: [0, 0, 1, 1], palisade: [1, 1, 1, 1],
  road: [0, 1, 1, 1], trade: [0, 1, 1, 1], academy: [0, 0, 1, 1], hospital: [0, 0, 1, 1], exchange: [0, 0, 0, 1], harbour: [0, 0, 0, 1], observatory: [0, 0, 0, 1] };
const countOf = (st, t) => GLOB[t] ? (st[GLOB[t]] ? 1 : 0) : blds(st).filter(([, b]) => b.type === t).length;
const fmt = v => (Math.round(v * 10) / 10).toString();
const EVENTS = [
  { id: 'fair', name: 'Fair winds', text: 'An ordinary season. Nothing to blame.' },
  { id: 'summer', name: 'Long summer', text: 'Every day has one extra hour of light.' },
  { id: 'lean', name: 'Lean harvest', text: 'Fields feed a quarter less.' },
  { id: 'generous', name: 'A generous Keeper', text: 'Interest is lower this season.' },
  { id: 'redsails', name: 'Red sails', text: 'Raiders come stronger this season.' }];
const cost = (type, n, L) => Math.round(B[type].base * (1 + 0.45 * n) * costMul(L));
const LOOK_EVERY = 3, LOOKS = 7; // a new look every 3 levels, 7 looks per building (levels 0-2, 3-5 ... 18-20)
const stageOf = n => Math.min(LOOKS - 1, Math.floor(n / LOOK_EVERY));
function lotKeys(tier) { const r = (TIERS[tier].grid - 1) / 2, out = []; for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (i || j) out.push(i + ',' + j); return out; }
const kij = k => k.split(',').map(Number);
// big looks spread out: from look 5 (level 12+) some buildings take a 2x2 block, at look 7 (level 18+) a 3x3, but only into free land behind them (-i/-j)
const FOOT = { field: [0, 0, 0, 0, 2, 2, 3], workshop: [0, 0, 0, 0, 2, 2, 3], tower: [0, 0, 0, 0, 0, 2, 2], bank: [0, 0, 0, 0, 2, 2, 3], lantern: [0, 0, 0, 0, 2, 2, 3], mirror: [0, 0, 0, 0, 2, 2, 3],
  trade: [0, 0, 0, 0, 2, 2, 3], academy: [0, 0, 0, 0, 2, 2, 3], hospital: [0, 0, 0, 0, 2, 2, 3], exchange: [0, 0, 0, 0, 2, 2, 3], harbour: [0, 0, 0, 0, 2, 2, 3], observatory: [0, 0, 0, 0, 2, 2, 3] };
const CL_CACHE = { sig: null, v: null, tick: 0, st: null }; var CLAIM_TICK = 0; // the game bumps CLAIM_TICK once per frame
function claims(st) { if (CLAIM_TICK && CL_CACHE.tick === CLAIM_TICK && CL_CACHE.st === st) return CL_CACHE.v; let sig = st.tier + ':'; for (const k in st.lots) { const b = st.lots[k]; if (b) sig += k + b.type[0] + b.n + ';'; } if (CL_CACHE.sig === sig) { CL_CACHE.tick = CLAIM_TICK; CL_CACHE.st = st; return CL_CACHE.v; }
  const owner = {}, size = {}, list = blds(st).filter(([, b]) => FOOT[b.type] && FOOT[b.type][stageOf(b.n)]).sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1));
  for (const [k, b] of list) { const [i, j] = kij(k); for (let f = FOOT[b.type][stageOf(b.n)]; f >= 2; f--) { const t = []; let ok = true;
      for (let a = 0; a < f && ok; a++) for (let c = 0; c < f; c++) { if (!a && !c) continue; const q = (i - a) + ',' + (j - c); if (st.lots[q] !== null || owner[q]) { ok = false; break; } t.push(q); }
      if (ok) { t.forEach(q => owner[q] = k); size[k] = f; break; } } }
  CL_CACHE.sig = sig; CL_CACHE.tick = CLAIM_TICK; CL_CACHE.st = st; return CL_CACHE.v = { owner, size }; }
const isFree = (st, k) => st.lots[k] === null && !claims(st).owner[k];
function newGame(o = {}) {
  const seed = o.seed || 1;
  const st = { seed, rng: makeRng(seed * 97 + 13), L: 1, xp: 0, tier: 0, hours: 8, debt: 0, pop: 6, lots: {}, pal: null, road: null, tech: {}, researching: null, caravan: 0, price: 1,
    day: 1, hour: 0, dayLen: BASE_DAY, shortTomorrow: 0, season: 1, event: null, phase: 'day', log: [], stats: { borrowed: 0, repaid: 0, interest: 0, seized: 0, raidsWon: 0, raidsLost: 0, bossWon: 0, bossLost: 0, levelUps: 0, tierUps: 0 }, noMorning: false, pending: null };
  for (const k of lotKeys(0)) st.lots[k] = null;
  startSeason(st); return st;
}
function startSeason(st) { st.event = o_pick(st); st.dawnDebt = 0; st.day = 1; st.hour = 0; st.dayLen = dayLength(st, 0); }
function o_pick(st) { return EVENTS[Math.floor(st.rng() * EVENTS.length)].id; }
const limit = st => Math.round(45 * costMul(st.L) * TIERS[st.tier].lim * (hasB(st, 'exchange') ? 1.15 + 0.01 * lvOf(st, 'exchange') : 1));
function rate(st) { let r = 0.25; if (hasB(st, 'bank')) r /= 2; if (st.event === 'generous') r *= 0.6; if (st.tech && st.tech.ledgers) r *= 0.8; if (hasB(st, 'exchange')) r *= 0.7 - 0.01 * lvOf(st, 'exchange'); return r; }
function blds(st) { const out = []; for (const k in st.lots) if (st.lots[k]) out.push([k, st.lots[k]]); return out; }
const hasB = (st, t) => blds(st).some(([, b]) => b.type === t);
// grey (borrowed) land: front lots first, fraction = debt / credit limit
const GO_CACHE = {}, GS_CACHE = new Map();
function greyOrder(st) { const n = Object.keys(st.lots).length; if (GO_CACHE[n]) return GO_CACHE[n]; return GO_CACHE[n] = Object.keys(st.lots).sort((a, b) => { const [ai, aj] = kij(a), [bi, bj] = kij(b); return (bi + bj) - (ai + aj) || ai - bi; }); }
function greyCount(st) { return st.debt <= 0 ? 0 : Math.ceil(Math.min(1, st.debt / limit(st)) * Object.keys(st.lots).length); }
function greySet(st) { const c = greyCount(st), n = Object.keys(st.lots).length, key = n * 1000 + c; let g = GS_CACHE.get(key); if (!g) { g = new Set(greyOrder(st).slice(0, c)); GS_CACHE.set(key, g); } return g; }
const greyFrac = st => Math.min(1, st.debt / limit(st));
function sumEff(st, f) { const g = greySet(st); let s = 0; for (const [k, b] of blds(st)) { const e = B[b.type][f]; if (e) s += e(b.n) * (g.has(k) ? 0.5 : 1); } return s; }
const food = st => (BASE_FOOD + sumEff(st, 'food')) * (st.event === 'lean' ? 0.75 : 1) * (st.tech && st.tech.rotation ? 1.15 : 1);
const housing = st => BASE_HOUSE + sumEff(st, 'house');
const popRoom = st => Math.min(Math.floor(housing(st)), TIERS[st.tier].popCap); // homes, capped by what the tier can hold
const fed = st => Math.min(st.pop, Math.floor(food(st)));
const roadMul = st => st.road ? 1.05 + 0.01 * st.road.n : 1;
const income = st => (4 + peopleInc(st) + sumEff(st, 'inc') * roadMul(st)) * (st.tech && st.tech.looms ? 1.1 : 1);
function defence(st, o = {}) { let d = (st.pal ? B.palisade.def(st.pal.n) : 0) + sumEff(st, 'def') + peopleDef(st) * (o.walls ? 2 : 1); if (st.tech && st.tech.crossbows) d *= 1.12; if (o.borrow) d *= duskMul(st); return Math.round(d); }
const duskMul = st => hasB(st, 'harbour') ? 1.5 : 1.3;
function dayLength(st, short) { let d = BASE_DAY - short; if (st.event === 'summer') d++; if (hasB(st, 'mirror')) d++; return Math.max(MIN_DAY, d); }
// raiders come for what you hold: threat follows your wealth (Hours in hand + everything built), in level-adjusted Hours
const RAID_K = { 2: [0.45, 5], 4: [0.65, 7] }, BOSS_K = [0.78, 8], THREAT_EXP = 0.63;
// difficulty ramp by player level: a long gentle slope, steeper only near the top (Hill curve again)
const ramp = L => 0.68 + 0.42 * L * L / (L * L + 16) + 0.01 * L;
const wealth = st => st.hours + st.caravan + (st.pal ? st.pal.inv : 0) + (st.road ? st.road.inv : 0) + blds(st).reduce((a, [, b]) => a + b.inv, 0);
function nominal(st, day = st.day) { const kind = DAY_KIND[day]; if (!kind) return 0; const ev = (st.event === 'redsails' ? 1.2 : 1) * ramp(st.L) * TIERS[st.tier].threat * (st.breather && kind === 'raid' ? 0.8 : 1), w = Math.pow(Math.max(0, wealth(st)) / costMul(st.L), THREAT_EXP);
  if (kind === 'boss') return Math.round((BOSS_K[0] * w + BOSS_K[1] + bossDebtK(st) * (day === st.day ? Math.max(st.debt, st.dawnDebt || 0) : st.debt) / costMul(st.L)) * ev);
  return Math.round((RAID_K[day][0] * w + RAID_K[day][1]) * ev); }
const bossDebtK = st => hasB(st, 'observatory') ? 0.55 * (0.6 - 0.01 * lvOf(st, 'observatory')) : 0.55;
const spread = (st, day = st.day) => DAY_KIND[day] === 'boss' && hasB(st, 'observatory') ? 0.05 : 0.15; // the Observatory reads the Long Dusk exactly
const raidRange = (st, day = st.day) => { const s = nominal(st, day), p = spread(st, day); return s ? [Math.round(s * (1 - p)), Math.round(s * (1 + p))] : null; };
const tierCap = st => TIERS[st.tier].cap;
function canBuild(st, key, type) { const b = B[type]; if (b.tier && st.tier < b.tier) return false;
  if (GLOB[type]) return !st[GLOB[type]] && affordable(st, type, 0);
  if (!isFree(st, key) || countOf(st, type) >= COUNT[type][st.tier]) return false; return affordable(st, type, 0); }
function affordable(st, type, n) { const c = cost(type, n, st.L); return B[type].credit ? st.debt + c <= limit(st) : st.hours >= c; }
function pay(st, type, n) { const c = cost(type, n, st.L); if (B[type].credit) { st.debt += c; st.stats.borrowed += c; } else st.hours -= c; return c; }
function gainXP(st, x) { st.xp += x; const ups = []; while (st.L < MAX_LEVEL && st.xp >= xpNeed(st.L)) { st.xp -= xpNeed(st.L); st.L++; st.stats.levelUps++; ups.push(st.L); } if (ups.length) st.log.push({ day: st.day, season: st.season, levelUp: st.L }); return ups; }
function build(st, key, type) { CL_CACHE.tick = -1; if (!canBuild(st, key, type)) return false; const c = pay(st, type, 0);
  if (GLOB[type]) st[GLOB[type]] = { n: 0, inv: c }; else st.lots[key] = { type, n: 0, inv: c }; gainXP(st, 2); return true; }
const bAt = (st, key) => key === 'pal' || key === 'road' ? st[key] : st.lots[key];
const typeAt = (st, key) => key === 'pal' ? 'palisade' : key === 'road' ? 'road' : st.lots[key] && st.lots[key].type;
function canUpgrade(st, key) { const b = bAt(st, key); return !!b && b.n < tierCap(st) && affordable(st, typeAt(st, key), b.n + 1); }
function upgrade(st, key) { CL_CACHE.tick = -1; if (!canUpgrade(st, key)) return false; const b = bAt(st, key), type = typeAt(st, key); b.inv += pay(st, type, b.n + 1); b.n++; gainXP(st, 1); return true; }
function borrow(st, x) { x = Math.min(Math.round(x), limit(st) - st.debt); if (x <= 0) return 0; st.debt += x; st.hours += x; st.stats.borrowed += x;
  // borrowed time is literal: today gets longer, tomorrow shorter
  const dl = Math.min(3, Math.floor(x / (5 * costMul(st.L)))); st.dayLen += dl; st.shortTomorrow += dl; return x; }
function repay(st, x) { x = Math.min(Math.floor(x), Math.floor(st.hours), st.debt); if (x <= 0) return 0; st.debt -= x; st.hours -= x; st.stats.repaid += x; return x; }
function tickHour(st) { if (st.phase !== 'day') return null; st.hours += income(st) / BASE_DAY; st.hour++; if (st.hour >= st.dayLen) { st.phase = 'dusk'; return { dusk: true, kind: DAY_KIND[st.day] || 'quiet' }; } return null; }
// raid decision at dusk: 'hold' | 'borrow' (borrow the dusk: +30% defence, loan of 20% of the limit) | 'walls' (everyone fights: villagers count double, no morning bonus)
const duskLoan = st => Math.round(0.2 * limit(st));
const canBorrowDusk = st => limit(st) - st.debt >= duskLoan(st);
function resolveDusk(st, decision = 'hold', rnd = st.rng) {
  const kind = DAY_KIND[st.day] || 'quiet'; st.phase = 'night'; CL_CACHE.tick = -1;
  if (kind === 'quiet') { const ev = { day: st.day, quiet: true }; st.log.push(ev); return ev; }
  if (decision === 'borrow') { if (canBorrowDusk(st)) { const x = duskLoan(st); st.debt += x; st.hours += x; st.stats.borrowed += x; st.shortTomorrow += 1; } else decision = 'hold'; }
  if (decision === 'walls') st.noMorning = true;
  const S = Math.round(nominal(st) * (1 - spread(st) + 2 * spread(st) * rnd())), D = defence(st, { walls: decision === 'walls', borrow: decision === 'borrow' }), boss = kind === 'boss';
  const ev = { day: st.day, season: st.season, boss, S, D, decision, won: D >= S, loot: 0, stolen: 0, damaged: [], villagersLost: 0 };
  if (ev.won) { ev.loot = Math.round(0.12 * income(st) + 2); st.hours += ev.loot; boss ? st.stats.bossWon++ : st.stats.raidsWon++; gainXP(st, boss ? 20 + 2 * st.L : 8 + st.L); }
  else { boss ? st.stats.bossLost++ : st.stats.raidsLost++; gainXP(st, boss ? 6 : 3);
    const f = Math.min(1, (S - D) / S) * (boss ? 1.5 : 1);
    const hosp = hasB(st, 'hospital'), heal = hosp ? 0.4 + 0.02 * lvOf(st, 'hospital') : 0;
    ev.stolen = Math.round(Math.min(st.hours, f * income(st) * (hosp ? 0.8 : 1))); st.hours -= ev.stolen;
    let hits = Math.ceil(f * (4 + 2 * st.tier)) + (st.road ? 1 : 0) - (hosp ? 1 : 0); /* raiders run the roads; the hospital patches grey land */ const g = greyOrder(st).slice(0, greyCount(st)), order = g.concat(greyOrder(st).filter(k => !g.includes(k))).filter(k => st.lots[k]); // raiders hit grey land first
    for (const k of order) { if (hits <= 0) break; const b = st.lots[k]; if (b.n === 0) { if (boss) { st.lots[k] = null; ev.damaged.push({ k, type: b.type, destroyed: true }); } else ev.damaged.push({ k, type: b.type, levels: 0 }); } else { b.n--; b.inv *= 0.9; ev.damaged.push({ k, type: b.type, levels: 1 }); } hits--; }
    if (hits > 0 && st.pal && st.pal.n > 0) { st.pal.n--; ev.damaged.push({ k: 'pal', type: 'palisade', levels: 1 }); }
    ev.villagersLost = Math.min(st.pop - 1, Math.ceil(f * 0.08 * st.pop * (decision === 'walls' ? 2 : 1) * (boss ? 2 : 1) * (1 - heal))); ev.saved = hosp ? Math.round(f * 0.08 * st.pop * (decision === 'walls' ? 2 : 1) * (boss ? 2 : 1) * heal) : 0; st.pop -= ev.villagersLost; }
  if (kind === 'raid') st.breather = !ev.won; else st.breather = true; // breathers after spikes
  st.log.push(ev); return ev;
}
// night: interest, default (seizure), XP; then morning: growth, bonus, tier-up, next day / season
function night(st) { CL_CACHE.tick = -1;
  const ev = { interest: 0, seized: null, ups: [], tierUp: null, left: 0, morning: 0, seasonEnd: null };
  if (st.debt > 0) { ev.interest = Math.ceil(st.debt * rate(st)); st.debt += ev.interest; st.stats.interest += ev.interest; }
  if (st.debt > limit(st)) { // default: the Clockkeeper seizes the most valuable building, grey land first
    const g = greySet(st); let best = null; for (const [k, b] of blds(st)) { const score = b.inv + (g.has(k) ? 1e6 : 0); if (!best || score > best.score) best = { k, b, score }; }
    if (best) { const credit = Math.round(best.b.inv * 0.6); st.lots[best.k] = null; st.debt = Math.max(0, st.debt - credit); ev.seized = { k: best.k, type: best.b.type, n: best.b.n, credit }; st.stats.seized++; st.seizedSeason = (st.seizedSeason || 0) + 1; st.log.push({ day: st.day, season: st.season, seized: ev.seized }); }
    else { st.debt = limit(st); if (st.pop > 1) { ev.servant = Math.min(st.pop - 1, Math.max(1, Math.round(st.pop * 0.03))); st.pop -= ev.servant; } } }
  if (st.researching) { st.tech[st.researching] = true; ev.researched = st.researching; st.researching = null; }
  if (st.caravan) { ev.caravan = Math.round(st.caravan * st.price * (0.75 + 0.3 * st.rng())); ev.stake = st.caravan; st.hours += ev.caravan; st.caravan = 0; }
  st.price = Math.round((0.75 + 0.7 * st.rng()) * 100) / 100; // tomorrow's caravan price, shown in advance
  ev.ups = gainXP(st, 4 + st.L);
  if (st.day >= SEASON_DAYS) { const boss = st.log.filter(e => e.boss && e.season === st.season).pop(); ev.seasonEnd = { season: st.season, won: !!(boss && boss.won), clean: !st.seizedSeason }; st.seizedSeason = 0; st.season++; startSeason(st); }
  else { st.day++; st.hour = 0; st.dayLen = dayLength(st, st.shortTomorrow); st.dawnDebt = DAY_KIND[st.day] === 'boss' ? st.debt : 0; /* Hesper's ledger closes at dawn on the last day */ }
  st.shortTomorrow = 0;
  // morning
  const tgt = Math.min(popRoom(st), Math.floor(food(st)));
  if (st.pop > Math.floor(food(st)) && st.pop > 1) { ev.left = Math.min(st.pop - 1, Math.max(1, Math.ceil((st.pop - food(st)) / 2))); st.pop -= ev.left; }
  else if (st.pop < tgt) { let g = Math.max(1, Math.ceil((tgt - st.pop) / 2)); if (st.tier === 0) g = Math.min(g, 8); st.pop += g; ev.arrived = g; } // founders come ashore a few at a time
  ev.morning = st.noMorning ? 0 : Math.round(income(st) * 0.3); st.hours += ev.morning; st.noMorning = false;
  const nx = TIERS[st.tier + 1]; if (nx && ev.seasonEnd && ev.seasonEnd.won && ev.seasonEnd.clean && st.L >= nx.lvl && st.pop >= nx.pop) { /* the island only grows after you hold the Long Dusk, in a season Hesper took nothing */ st.tier++; for (const k of lotKeys(st.tier)) if (!(k in st.lots)) st.lots[k] = null; ev.tierUp = st.tier; st.stats.tierUps++; st.log.push({ day: st.day, season: st.season, tierUp: st.tier }); }
  st.phase = 'day'; return ev;
}
function netWorth(st) { let v = st.hours + st.caravan - st.debt + (st.pal ? st.pal.inv : 0) + (st.road ? st.road.inv : 0); for (const [, b] of blds(st)) v += b.inv; return v; }
/*CORE-END*/
