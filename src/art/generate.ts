/**
 * Browser-side generator for the STAND-IN atlases. Run by `npm run standins`, which saves the
 * pages into public/standin/<tier>/. Not part of the app bundle.
 */
import type { BuildingType, Era } from "../sim/catalog";
import { drawBaked, drawBoat, drawBuilding, drawFx, drawGnomon, drawGrain, drawGround, drawPart, drawProp, drawTent, drawWall, type Iso } from "./draw";
import { atlasSpecs, type FrameSpec } from "./manifest";
import { packShelves } from "./pack";

export interface GeneratedFile {
  path: string;
  dataUrl?: string;
  text?: string;
}

function drawFrame(ctx: CanvasRenderingContext2D, f: FrameSpec, s: number): void {
  const line = s === 1 ? 3 : 2; // the low tier is a separate export with a 2 px line (ART_BIBLE.md §2)
  const g: Iso = { ctx, ax: f.ax * s, ay: f.ay * s, n: 1, s, line };
  const parts = f.name.split("/");
  if (parts[0] === "city" || parts[0] === "town") {
    const era = parts[0] as Era;
    const type = parts[1] as BuildingType | "block";
    const look = Number(parts[2]);
    let seed = 0;
    for (const ch of f.name) seed = (seed * 31 + ch.charCodeAt(0)) % 97;
    drawBuilding(g, era, type, look, seed);
  } else if (parts[0] === "ground") drawGround(g, parts[1], "city");
  else if (parts[0] === "wall") drawWall(g, Number(parts[1]), parts[2], "city");
  else if (parts[0] === "prop") drawProp(g, parts[1], "city");
  else if (f.name === "tent") drawTent(g);
  else if (f.name === "gnomon") drawGnomon(g);
  else if (f.name === "gnomonShadow") {
    const gr = ctx.createLinearGradient(0, 0, f.w * s, 0);
    gr.addColorStop(0, "rgba(61,52,40,0.45)");
    gr.addColorStop(1, "rgba(61,52,40,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(0, (f.h * s) / 2 - 6 * s);
    ctx.lineTo(f.w * s, (f.h * s) / 2 - 1);
    ctx.lineTo(f.w * s, (f.h * s) / 2 + 1);
    ctx.lineTo(0, (f.h * s) / 2 + 6 * s);
    ctx.fill();
  } else if (parts[0] === "part") drawPart(ctx, f.w, f.h, parts[1], parts[2], s, line);
  else if (parts[0] === "baked") drawBaked(ctx, parts[1], Number(parts[2]), s, line);
  else if (f.name === "boat") drawBoat(ctx, s, line);
  else if (f.name === "margery") drawBaked(ctx, "trade", 0, s * 0.6, line);
  else drawFx(ctx, f.name, f.w * s, f.h * s);
}

export function generate(tier: "high" | "low"): GeneratedFile[] {
  const s = tier === "low" ? 0.5 : 1;
  const files: GeneratedFile[] = [];
  const index: Record<string, string[]> = {};
  for (const spec of atlasSpecs()) {
    const max = tier === "low" ? 1024 : 2048;
    const items = spec.frames.map((f) => ({ name: f.name, w: Math.ceil(f.w * s), h: Math.ceil(f.h * s) }));
    const packed = packShelves(items, max);
    const byName = new Map(spec.frames.map((f) => [f.name, f]));
    index[spec.name] = [];
    packed.pages.forEach((page, p) => {
      const canvas = document.createElement("canvas");
      canvas.width = page.w;
      canvas.height = page.h;
      const ctx = canvas.getContext("2d")!;
      const frames: Record<string, unknown> = {};
      for (const it of packed.placed.filter((x) => x.page === p)) {
        const f = byName.get(it.name)!;
        ctx.save();
        ctx.beginPath();
        ctx.rect(it.x, it.y, it.w, it.h);
        ctx.clip();
        ctx.translate(it.x, it.y);
        drawFrame(ctx, f, s);
        ctx.restore();
        frames[it.name] = {
          frame: { x: it.x, y: it.y, w: it.w, h: it.h },
          sourceSize: { w: it.w, h: it.h },
          spriteSourceSize: { x: 0, y: 0, w: it.w, h: it.h },
          anchor: { x: f.ax / f.w, y: f.ay / f.h },
        };
      }
      const base = `${spec.name}-${p}`;
      files.push({ path: `${tier}/${base}.png`, dataUrl: canvas.toDataURL("image/png") });
      files.push({
        path: `${tier}/${base}.json`,
        text: JSON.stringify({ frames, meta: { image: `${base}.png`, size: { w: page.w, h: page.h }, scale: s, standin: true, mipmaps: spec.mipmaps } }),
      });
      index[spec.name].push(`${base}.json`);
    });
  }
  const grainSize = tier === "low" ? 256 : 512;
  const gc = document.createElement("canvas");
  gc.width = gc.height = grainSize;
  drawGrain(gc.getContext("2d")!, grainSize, 11);
  files.push({ path: `${tier}/grain.png`, dataUrl: gc.toDataURL("image/png") });
  files.push({ path: `${tier}/index.json`, text: JSON.stringify({ standin: true, scale: s, atlases: index, grain: "grain.png" }, null, 1) });
  return files;
}

declare global {
  interface Window {
    __generate?: typeof generate;
  }
}
window.__generate = generate;
