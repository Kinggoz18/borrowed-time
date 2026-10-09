/**
 * Scripted camera for the stress loop. The camera moves, then settles and holds (plan §5: no
 * per-frame zoom wobble), so caches stay valid between moves. Pure: a function of time.
 */
export interface Shot {
  /** Focus in world units. */
  x: number;
  y: number;
  /** Multiple of the fit zoom. */
  zoom: number;
}
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  settled: boolean;
}

export const CITY_FIT_ZOOM = 0.33;

/** Fit zoom for a viewport so the city skyline fills the width (0.33 at the 540 px reference). */
export function fitZoom(viewW: number, worldW: number): number {
  return Math.max(0.08, Math.min(1.5, (viewW / worldW) * 1.02));
}

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

export function cameraAt(seconds: number, shots: Shot[], moveS: number, holdS: number, fit: number): CameraState {
  const per = moveS + holdS;
  const total = per * shots.length;
  const t = ((seconds % total) + total) % total;
  const k = Math.floor(t / per);
  const local = t - k * per;
  const a = shots[(k + shots.length - 1) % shots.length];
  const b = shots[k];
  if (local >= moveS) return { x: b.x, y: b.y, zoom: b.zoom * fit, settled: true };
  const u = ease(local / moveS);
  // Zoom interpolates in log space so zooming in and out feel even.
  const z = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * u);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, zoom: z * fit, settled: false };
}
