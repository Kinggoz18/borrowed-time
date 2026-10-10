import type { CrestDesc } from "../core/save";
import { renderCrest } from "./crest";

export function renderShareCard(opts: { colonyName: string; crest: CrestDesc | null; season: number; line: string }): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f3e7c6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#3d3428";
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  if (opts.crest) {
    const c = document.createElement("canvas");
    renderCrest(c, opts.crest, 96);
    ctx.drawImage(c, 40, 40);
  }
  ctx.fillStyle = "#3d3428";
  ctx.font = "bold 32px system-ui, sans-serif";
  ctx.fillText(opts.colonyName, 160, 80);
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(`Season ${opts.season}`, 160, 110);
  ctx.font = "italic 22px Georgia, serif";
  wrap(ctx, opts.line, 40, 180, canvas.width - 80, 28);
  return canvas;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number): void {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, y);
      y += lh;
      line = w;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

export async function shareCardCanvas(canvas: HTMLCanvasElement, title: string): Promise<void> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
  if (!blob) return;
  const { sharePng } = await import("../platform/share");
  await sharePng(blob, title, "borrowed-time-card.png");
}
