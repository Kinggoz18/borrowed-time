/** GPU-side counters: draw calls per frame (WebGL call wrapper) and a texture memory estimate. */
import type { Renderer, TextureSource } from "pixi.js";

export class DrawCallCounter {
  private count = 0;
  private last = 0;
  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    const g = gl as unknown as Record<string, unknown>;
    for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
      const fn = g[name];
      if (typeof fn !== "function") continue;
      g[name] = (...args: unknown[]) => {
        this.count++;
        return (fn as (...a: unknown[]) => unknown).apply(gl, args);
      };
    }
  }
  /** Call once per frame after rendering. */
  endFrame(): number {
    this.last = this.count;
    this.count = 0;
    return this.last;
  }
}

export function textureBytes(width: number, height: number, mipmaps: boolean, bytesPerPixel = 4): number {
  return width * height * bytesPerPixel * (mipmaps ? 4 / 3 : 1);
}

/**
 * Estimated GPU texture memory in MB: every texture Pixi has uploaded (atlases, render targets,
 * filter pool) as uncompressed RGBA, plus the canvas front and back buffers. Stand-ins are PNG, so
 * this is an upper bound against the plan's KTX2 budget (ASTC 4x4 is 8 bpp, a quarter of RGBA).
 */
export function textureMemoryMB(renderer: Renderer): { totalMB: number; atlasMB: number; targetsMB: number } {
  const managed = (renderer as unknown as { texture?: { managedTextures?: readonly TextureSource[] } }).texture?.managedTextures ?? [];
  let atlas = 0, targets = 0;
  for (const src of managed) {
    const bytes = textureBytes(src.pixelWidth, src.pixelHeight, src.mipLevelCount > 1 || src.autoGenerateMipmaps);
    if (src.uploadMethodId === "unknown") targets += bytes; // render targets have no upload source
    else atlas += bytes;
  }
  const canvas = renderer.canvas as HTMLCanvasElement;
  const back = canvas.width * canvas.height * 4 * 2;
  const mb = 1024 * 1024;
  return { totalMB: (atlas + targets + back) / mb, atlasMB: atlas / mb, targetsMB: (targets + back) / mb };
}

export function heapMB(): number {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? mem.usedJSHeapSize / (1024 * 1024) : 0;
}
