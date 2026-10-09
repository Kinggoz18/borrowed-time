/**
 * In-game figures: chunky 3/4 isometric miniatures (owner style sheet), ink outline,
 * 3-step light from the upper left, hats/boots/hair. Height stays PERSON_H / HESPER_H
 * so on-screen scale does not change; only the models do.
 */
import { BRASS_PIN, DRIFT, INK, SAIL, STRIPE, TARR, type Ramp } from "./palette";
import type { Ctx } from "./pen";

export type Job = "field" | "clockworks" | "trade" | "watch" | "raider" | "hesper" | "nell" | "ada" | "tobias" | "noon";
export const VILLAGER_JOBS: Job[] = ["field", "clockworks", "trade", "watch"];
export const NOTABLE_JOBS: Job[] = ["hesper", "nell", "ada", "tobias", "noon"];
export const JOBS: Job[] = [...VILLAGER_JOBS, "raider", ...NOTABLE_JOBS];
export type PersonAnim = "idle" | "walk" | "work";
export type PersonView = "se" | "sw" | "ne" | "nw";
export const PERSON_VIEWS: PersonView[] = ["se", "sw", "ne", "nw"];
export const PERSON_ANIMS: PersonAnim[] = ["idle", "walk", "work"];
export const ANIM_FRAMES: Record<PersonAnim, number> = { idle: 2, walk: 4, work: 2 };

/** Figure height in world px: villagers 0.4 of a tile, Hesper 0.55 (ART_BIBLE.md §10). */
export const PERSON_H = 26;
export const HESPER_H = 35;

export const personFrame = (job: Job): { w: number; h: number; ax: number; ay: number } => {
  if (job === "hesper") return { w: 26, h: 42, ax: 13, ay: 40 };
  if (job === "tobias") return { w: 32, h: 36, ax: 16, ay: 34 };
  if (job === "nell" || job === "ada" || job === "noon") return { w: 30, h: 36, ax: 15, ay: 34 };
  return { w: 28, h: 34, ax: 14, ay: 32 };
};

export const personFrameName = (job: Job, anim: PersonAnim, view: PersonView, frame: number): string =>
  `p/${job}/${anim}/${view}/${frame}`;

const SKIN: Ramp = { light: "#F0D0A8", base: "#E2B98F", shade: "#C49A74" };
const BOOT: Ramp = { light: "#5F5244", base: "#3F362E", shade: "#2A2420" };
const WHEAT: Ramp = { light: "#E2C67E", base: "#C0A369", shade: "#8C784D" };
const OIL: Ramp = { light: "#B5B0A6", base: "#8E8A82", shade: "#5E5A54" };
const COAT: Ramp = { light: "#5A4E48", base: "#3F3633", shade: "#2B2422" };
const MOSS: Ramp = { light: "#9DAA6E", base: "#7E8F55", shade: "#5C6B3D" };
const OAK: Ramp = { light: "#987554", base: "#72583F", shade: "#4F3C2C" };
const OCHRE: Ramp = { light: "#DDB879", base: "#BD9D68", shade: "#8F754F" };
const GOLD_RIM = "#C4A15A";

type Hat = "straw" | "helm" | "cap" | "goggles" | "bun" | "hood" | "oil" | "ada" | "none";
type Prop = "hoe" | "spear" | "cog" | "sack" | "oar" | "ledger" | "rope" | "fiddle" | "gear" | "none";

interface Kit {
  tunic: Ramp;
  pants: Ramp;
  hair: string;
  hat: Hat;
  prop: Prop;
  tall: boolean;
  beard?: string;
  hoodGold?: boolean;
  faceless?: boolean;
  coat?: boolean;
  sash?: boolean;
  apron?: boolean;
}

const KIT: Record<Job, Kit> = {
  field: { tunic: MOSS, pants: DRIFT, hair: "#5C4030", hat: "straw", prop: "hoe", tall: false },
  clockworks: { tunic: OAK, pants: BOOT, hair: "#6B4A32", hat: "goggles", prop: "cog", tall: false },
  trade: { tunic: OCHRE, pants: DRIFT, hair: "#7A5A3A", hat: "cap", prop: "sack", tall: false },
  watch: { tunic: DRIFT, pants: BOOT, hair: "#3D3428", hat: "helm", prop: "spear", tall: false },
  raider: { tunic: TARR, pants: TARR, hair: "#2A2420", hat: "hood", prop: "oar", tall: false, faceless: true },
  hesper: { tunic: COAT, pants: COAT, hair: "#2A2420", hat: "bun", prop: "ledger", tall: true, coat: true, sash: true },
  nell: { tunic: OIL, pants: BOOT, hair: "#2A2420", hat: "none", prop: "rope", tall: false, coat: true },
  ada: { tunic: { light: "#E8DCC4", base: "#D4C4A4", shade: "#A89474" }, pants: OAK, hair: "#6B4A32", hat: "ada", prop: "gear", tall: false, apron: true },
  tobias: { tunic: MOSS, pants: DRIFT, hair: "#C8C1B1", hat: "cap", prop: "fiddle", tall: false, beard: "#C8C1B1" },
  noon: { tunic: TARR, pants: TARR, hair: "#2A2420", hat: "hood", prop: "none", tall: false, faceless: true, hoodGold: true, coat: true },
};

const WALK: { l: number; r: number; hop: number }[] = [
  { l: 1, r: -1, hop: 0 },
  { l: 0.25, r: -0.25, hop: 2 },
  { l: -1, r: 1, hop: 0 },
  { l: -0.25, r: 0.25, hop: 2 },
];

export function drawPerson(c: Ctx, ax: number, ay: number, s: number, job: Job, frame: number, anim: PersonAnim = "walk", view: PersonView = "se"): void {
  const kit = KIT[job];
  const L = Math.max(1.15, 0.85 * s);
  const back = view === "ne" || view === "nw";
  const flip = view === "sw" || view === "nw" ? -1 : 1;
  const n = Math.max(0, frame | 0);
  const gait = anim === "walk" ? WALK[n % 4] : { l: 0, r: 0, hop: anim === "idle" && n % 2 ? 1 : 0 };
  const hop = gait.hop;
  const work = anim === "work" ? (n % 2 ? 1 : 0) : 0.35;
  const tilt = anim === "idle" && n % 2 ? 0.12 : 0;
  c.save();
  c.translate(ax, ay - hop * s);
  c.scale(flip, 1);
  c.lineJoin = "round";
  c.lineCap = "round";
  const X = (x: number) => x * s;
  const Y = (y: number) => y * s;
  const poly = (pts: [number, number][], fill: string, stroke = true): void => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = INK;
      c.lineWidth = L;
      c.stroke();
    }
  };
  const oval = (x: number, y: number, rx: number, ry: number, fill: string, stroke = true): void => {
    c.beginPath();
    c.ellipse(X(x), Y(y), rx * s, ry * s, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = INK;
      c.lineWidth = L;
      c.stroke();
    }
  };

  // soft ink ground shadow (not a slab)
  c.save();
  c.globalAlpha = 0.22;
  oval(0, -0.4, kit.tall ? 6.2 : 5.4, 2.1, INK, false);
  c.restore();

  const hipY = kit.tall ? -11 : -9.5;
  const neckY = kit.tall ? -26.5 : -17.6;
  const headY = neckY - 3.4;
  const tw = kit.tall ? 3.4 : 4.1;
  const armY = neckY + 1.8;

  const boot = (x: number, y: number, fill: string): void => {
    poly([[x - 1.5, y - 1.2], [x + 2.1, y - 1.4], [x + 2.2, y + 0.4], [x - 1.6, y + 0.5]], fill);
  };
  const leg = (side: number, stride: number, fill: string, bootFill: string): void => {
    const hipX = side * 1.5;
    const footX = side * 1.7 + stride * 2.2;
    const footY = -0.2;
    poly([[hipX - 1.2, hipY], [hipX + 1.3, hipY], [footX + 1.4, footY - 2.2], [footX - 1.3, footY - 2]], fill);
    boot(footX, footY, bootFill);
  };

  // far limbs first
  const farFill = kit.tunic.shade;
  arm(c, s, L, -tw + 0.4, armY, back ? 0.35 : -0.55, kit.tall ? 10 : 8.2, farFill, "none");
  leg(-1, gait.l, kit.pants.shade, BOOT.shade);

  // near leg, then body
  leg(1, gait.r, kit.pants.base, BOOT.base);

  if (kit.coat) {
    poly([[-tw - 0.2, neckY], [tw + 0.4, neckY], [tw + 2.4, -2.2], [0.4, -1.4], [-tw - 2.2, -2.4]], kit.tunic.base);
    poly([[0.6, neckY + 0.4], [tw + 0.2, neckY + 0.4], [tw + 1.8, -2.6], [0.7, -2.2]], kit.tunic.shade, false);
  } else {
    poly([[-tw, neckY], [tw, neckY], [tw - 0.7, hipY + 0.6], [-tw + 0.7, hipY + 0.6]], kit.tunic.base);
    poly([[0.7, neckY + 0.5], [tw - 0.3, neckY + 0.5], [tw - 1, hipY + 0.2], [0.7, hipY + 0.2]], kit.tunic.shade, false);
  }
  // belt
  if (!kit.faceless) poly([[-tw + 0.6, hipY - 1.6], [tw - 0.5, hipY - 1.8], [tw - 0.6, hipY - 0.4], [-tw + 0.5, hipY - 0.2]], BOOT.base);
  if (kit.apron) {
    poly([[-tw + 0.8, hipY - 4], [tw - 0.6, hipY - 4.2], [tw - 1.1, -2.4], [-tw + 1.2, -2.2]], OAK.base);
    poly([[-0.4, hipY - 4], [0.6, hipY - 4], [0.6, -2.4], [-0.4, -2.3]], OAK.shade, false);
  }
  if (kit.sash) {
    c.save();
    c.beginPath();
    c.moveTo(X(-tw + 0.2), Y(neckY + 1));
    c.lineTo(X(-tw + 2.6), Y(neckY + 0.2));
    c.lineTo(X(tw + 1.4), Y(hipY - 1.2));
    c.lineTo(X(tw - 1.2), Y(hipY + 0.4));
    c.closePath();
    c.fillStyle = STRIPE.base;
    c.fill();
    c.clip();
    c.strokeStyle = SAIL.light;
    c.lineWidth = 0.85 * s;
    for (let k = -2; k < 8; k++) {
      c.beginPath();
      c.moveTo(X(-tw - 2 + k * 2.1), Y(neckY - 2));
      c.lineTo(X(-tw + 2 + k * 2.1), Y(hipY + 3));
      c.stroke();
    }
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = L * 0.85;
    c.beginPath();
    c.moveTo(X(-tw + 0.2), Y(neckY + 1));
    c.lineTo(X(-tw + 2.6), Y(neckY + 0.2));
    c.lineTo(X(tw + 1.4), Y(hipY - 1.2));
    c.lineTo(X(tw - 1.2), Y(hipY + 0.4));
    c.closePath();
    c.stroke();
  }

  const armAng = anim === "work" ? -0.15 - work * 0.7 : anim === "walk" ? 0.2 * gait.r : -0.35;
  arm(c, s, L, tw - 0.5, armY, armAng, kit.tall ? 10 : 8.2, kit.tunic.light, kit.prop);

  // head
  c.save();
  c.translate(X(back ? -0.4 : 0.6), Y(headY));
  c.rotate(tilt);
  oval(0, 0, kit.tall ? 3.2 : 3.15, kit.tall ? 3.5 : 3.4, kit.faceless ? TARR.base : SKIN.base);
  if (!back && !kit.faceless) {
    oval(-0.9, -0.2, 1.1, 1.3, SKIN.light, false);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(X(0.15), Y(0.15), 0.55 * s, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(X(1.55), Y(0.2), 0.55 * s, 0, Math.PI * 2);
    c.fill();
  }
  if (!kit.faceless) {
    // hair
    if (back) oval(0, -1.4, 3.3, 2.2, kit.hair, true);
    else poly([[-3.1, -0.4], [-2.8, -3.1], [0.2, -3.8], [2.6, -2.6], [3.0, 0.2], [2.2, -1.4], [-2.2, -1.2]], kit.hair);
  }
  if (kit.beard && !back) poly([[-1.6, 1.4], [-0.2, 3.6], [1.8, 3.4], [2.4, 1.2], [1.2, 1.8], [-0.8, 1.9]], kit.beard);
  hat(c, s, L, kit, back);
  c.restore();

  c.restore();
}

function arm(c: Ctx, s: number, L: number, x: number, y: number, ang: number, len: number, fill: string, kind: Prop): void {
  c.save();
  c.translate(x * s, y * s);
  c.rotate(ang);
  c.beginPath();
  c.moveTo(-1.25 * s, 0);
  c.lineTo(1.25 * s, 0);
  c.lineTo(1.05 * s, len * s);
  c.lineTo(-1.05 * s, len * s);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = L;
  c.stroke();
  if (kind !== "none") {
    c.translate(0, len * s);
    c.rotate(-ang * 0.8);
    propAt(c, s, L, kind);
  }
  c.restore();
}

function hat(c: Ctx, s: number, L: number, kit: Kit, back: boolean): void {
  const poly = (pts: [number, number][], fill: string): void => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = L;
    c.stroke();
  };
  const oval = (x: number, y: number, rx: number, ry: number, fill: string): void => {
    c.beginPath();
    c.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = L;
    c.stroke();
  };
  if (kit.hat === "straw") {
    oval(0.2, -2.2, 5.2, 1.5, WHEAT.base);
    poly([[-2.6, -2.4], [2.8, -2.6], [2.2, -5.2], [-1.8, -5.0]], WHEAT.light);
  } else if (kit.hat === "helm") {
    poly([[-3.2, -0.6], [3.4, -0.8], [2.6, -4.6], [0, -5.4], [-2.4, -4.4]], DRIFT.base);
    poly([[-2.8, -0.4], [3.0, -0.6], [2.6, 0.6], [-2.4, 0.7]], DRIFT.shade);
  } else if (kit.hat === "cap") {
    poly([[-3.0, -1.2], [3.4, -1.4], [2.4, -3.8], [-2.0, -3.6]], kit.tunic.shade);
    poly([[1.2, -1.3], [4.4, -0.6], [4.2, 0.2], [1.0, -0.6]], kit.tunic.base);
  } else if (kit.hat === "goggles" || kit.hat === "ada") {
    if (kit.hat === "ada") poly([[-2.4, -1.6], [2.6, -1.8], [2.0, -3.6], [-1.8, -3.4]], OAK.base);
    poly([[-2.8, -0.6], [-0.2, -0.8], [-0.2, 1.0], [-2.8, 1.1]], BRASS_PIN);
    poly([[0.4, -0.6], [3.0, -0.7], [3.0, 1.1], [0.4, 1.1]], BRASS_PIN);
    c.fillStyle = "#3A342E";
    c.beginPath();
    c.ellipse(-1.5 * s, 0.2 * s, 0.9 * s, 0.7 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(1.7 * s, 0.25 * s, 0.9 * s, 0.7 * s, 0, 0, Math.PI * 2);
    c.fill();
  } else if (kit.hat === "bun") {
    oval(back ? 0 : -0.6, -3.6, 2.1, 1.8, kit.hair);
    if (!back) poly([[-3.0, -0.8], [0.4, -1.4], [0.2, 0.6], [-2.8, 1.0]], kit.hair);
  } else if (kit.hat === "hood") {
    poly([[-3.6, 1.6], [-3.2, -3.4], [0.2, -5.2], [3.4, -3.2], [3.8, 1.8], [2.2, -0.6], [-2.0, -0.5]], TARR.base);
    if (kit.hoodGold) {
      c.strokeStyle = GOLD_RIM;
      c.lineWidth = Math.max(1.2, L * 1.1);
      c.beginPath();
      c.ellipse(0.3 * s, 0.3 * s, 2.4 * s, 2.8 * s, 0, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
    }
  } else if (kit.hat === "oil") {
    poly([[-3.4, -0.8], [3.2, -1.0], [2.6, -3.8], [-2.6, -3.5]], OIL.shade);
    // short dark hair at the temples
    if (!back) poly([[-3.2, -0.2], [-2.4, -2.4], [-1.0, -1.2], [-2.8, 1.2]], kit.hair);
  }
}

function propAt(c: Ctx, s: number, L: number, kind: Prop): void {
  c.strokeStyle = INK;
  c.lineWidth = L;
  const box = (bx: number, by: number, w: number, h: number, fill: string) => {
    c.beginPath();
    c.rect(bx * s, by * s, w * s, h * s);
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  if (kind === "hoe") {
    c.beginPath();
    c.moveTo(0, -8 * s);
    c.lineTo(0, 6 * s);
    c.stroke();
    box(-0.4, 4.8, 3.4, 1.6, "#A39A8A");
  } else if (kind === "spear") {
    c.beginPath();
    c.moveTo(0, -15 * s);
    c.lineTo(0, 5 * s);
    c.stroke();
    c.beginPath();
    c.moveTo(-1.3 * s, -14 * s);
    c.lineTo(0, -18 * s);
    c.lineTo(1.3 * s, -14 * s);
    c.closePath();
    c.fillStyle = "#A39A8A";
    c.fill();
    c.stroke();
  } else if (kind === "cog" || kind === "gear") {
    c.beginPath();
    for (let k = 0; k < 16; k++) {
      const r = (k % 2 ? 2.1 : 2.9) * s, a = (k / 16) * Math.PI * 2;
      c.lineTo(Math.cos(a) * r, 1.2 * s + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = BRASS_PIN;
    c.fill();
    c.stroke();
  } else if (kind === "sack") box(-2.4, -0.4, 4.8, 3.8, SAIL.shade);
  else if (kind === "oar") {
    c.beginPath();
    c.moveTo(0, -11 * s);
    c.lineTo(0, 5 * s);
    c.stroke();
    box(-1.2, 3.4, 2.4, 4.6, DRIFT.base);
  } else if (kind === "ledger") {
    box(-3.2, -1.4, 6.4, 4.4, "#72583F");
    c.fillStyle = SAIL.light;
    c.fillRect(-2.8 * s, 2.1 * s, 5.6 * s, 0.6 * s);
  } else if (kind === "rope") {
    c.strokeStyle = WHEAT.shade;
    c.lineWidth = 1.4 * s;
    c.beginPath();
    c.arc(0.4 * s, 1.2 * s, 2.4 * s, 0, Math.PI * 1.8);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = L / 2;
    c.stroke();
  } else if (kind === "fiddle") {
    c.beginPath();
    c.ellipse(-1.2 * s, 2.2 * s, 2.4 * s, 3.2 * s, -0.3, 0, Math.PI * 2);
    c.fillStyle = OAK.base;
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(0.4 * s, -0.4 * s);
    c.lineTo(4.6 * s, -6.2 * s);
    c.lineWidth = 1.1 * s;
    c.strokeStyle = OAK.light;
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = L;
    c.stroke();
  }
}
