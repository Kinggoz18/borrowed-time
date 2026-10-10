import type { CrestDesc } from "../core/save";

export const CREST_SHAPES = ["shield", "round", "banner"] as const;
export const CREST_CHARGES = ["sun", "wave", "tower", "oak"] as const;
export const CREST_COLORS = ["#8b4513", "#2f5d50", "#c45c4a", "#d4a574", "#3d4a5c", "#f3e7c6"] as const;

export function defaultCrest(): CrestDesc {
  return { shape: "shield", charge: "sun", c1: "#2f5d50", c2: "#d4a574" };
}

/** Deterministic crest raster (three sizes share the same geometry). */
export function renderCrest(canvas: HTMLCanvasElement, crest: CrestDesc, size: number): void {
  const ctx = canvas.getContext("2d")!;
  canvas.width = size;
  canvas.height = size;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = crest.c1;
  const pad = size * 0.08;
  if (crest.shape === "round") {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - pad, 0, Math.PI * 2);
    ctx.fill();
  } else if (crest.shape === "banner") {
    ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2);
    ctx.fillStyle = crest.c2;
    ctx.fillRect(pad * 2, pad * 2, size - pad * 4, size * 0.2);
  } else {
    ctx.beginPath();
    ctx.moveTo(size / 2, pad);
    ctx.lineTo(size - pad, size * 0.35);
    ctx.lineTo(size - pad * 1.2, size - pad);
    ctx.lineTo(pad * 1.2, size - pad);
    ctx.lineTo(pad, size * 0.35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = crest.c2;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.12;
  if (crest.charge === "sun") {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (crest.charge === "wave") {
    ctx.fillRect(cx - r * 2, cy, r * 4, r * 0.6);
  } else if (crest.charge === "tower") {
    ctx.fillRect(cx - r, cy - r * 2, r * 2, r * 3);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy + r, r, 0, Math.PI, true);
    ctx.fill();
  }
}

export function crestPixelHash(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d")!;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 16) h = (h * 31 + d[i]) >>> 0;
  return h.toString(16);
}
