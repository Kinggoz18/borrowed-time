/** Player settings, stored next to the save. */
import type { KV } from "../platform/storage";

export type OrientPref = "landscape" | "portrait" | "auto";

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  quality: "auto" | "high" | "mid" | "low";
  orientation: OrientPref;
  musicVol: number;
  sfxVol: number;
}
export const SETTINGS_KEY = "bt.settings";
export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  quality: "auto",
  orientation: "auto",
  musicVol: 0.65,
  sfxVol: 0.75,
};

export function clampVol(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

export async function loadSettings(kv: KV): Promise<Settings> {
  try {
    const raw = await kv.get(SETTINGS_KEY);
    const o = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    const sound = typeof o.sound === "boolean" ? o.sound : DEFAULT_SETTINGS.sound;
    return {
      sound,
      // a Phase 1 "Sound off" mute used to mean everything; keep that mute on first load
      music: typeof o.music === "boolean" ? o.music : sound,
      haptics: typeof o.haptics === "boolean" ? o.haptics : DEFAULT_SETTINGS.haptics,
      quality: o.quality && ["auto", "high", "mid", "low"].includes(o.quality) ? o.quality : DEFAULT_SETTINGS.quality,
      orientation: o.orientation && ["landscape", "portrait", "auto"].includes(o.orientation) ? o.orientation : DEFAULT_SETTINGS.orientation,
      musicVol: clampVol(o.musicVol, DEFAULT_SETTINGS.musicVol),
      sfxVol: clampVol(o.sfxVol, DEFAULT_SETTINGS.sfxVol),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export const saveSettings = (kv: KV, s: Settings): Promise<boolean> => kv.set(SETTINGS_KEY, JSON.stringify(s));
