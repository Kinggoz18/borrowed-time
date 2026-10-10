/**
 * The first view of the island: how far out the camera starts. Pure (no Pixi), so the rule is
 * unit-tested at every screen size.
 */
import { TW } from "./layout";

/** Plan before the owner's "scale out 30-40%": the camera started at 1.6x the ring fit, never narrower than MIN_LOT_PX per lot. */
export const OLD_PLAY_ZOOM = 1.6;
export const MIN_LOT_PX = 136;
/** The first view is at most this fraction of the previous default (owner: scale out about 30-40%)... */
export const SCALE_OUT = 0.65;
/** ...but always shows the whole ring and its shore strip (a little overshoot is the sea margin). */
export const FIT_SLACK = 1.08;

export interface FrameInput {
  /** zoom that fits the ring and shore strip in the play area */
  ringFit: number;
  /** zoom that fits the whole island and a margin of sea (the far overview) */
  fitZoom: number;
  /** device pixels per world unit at zoom 1 (renderer resolution x art unit) */
  per: number;
}

/** The previous default, kept for the comparison tests. */
export const oldDefaultZoom = (ringFit: number): number => Math.max(ringFit * OLD_PLAY_ZOOM, MIN_LOT_PX / TW);

/**
 * The default zoom: the previous one scaled out by SCALE_OUT, capped so the whole ring is visible,
 * and snapped down to a whole number of device pixels per art pixel (pixel-exact, no shimmer).
 * Below one device pixel per art pixel only the far overview is allowed, so it is used unsnapped.
 */
export function defaultZoom(i: FrameInput): number {
  const want = Math.min(oldDefaultZoom(i.ringFit) * SCALE_OUT, i.ringFit * FIT_SLACK);
  const d = want * i.per;
  const z = d < 1 ? want : Math.floor(d) / i.per;
  return Math.max(i.fitZoom, z);
}
