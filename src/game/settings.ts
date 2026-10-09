/** Player settings, stored next to the save. */
import type { KV } from "../platform/storage";

export interface Settings {
  sound: boolean;
  haptics: boolean;
  quality: "auto" | "high" | "mid" | "low";
}
export const SETTINGS_KEY = "bt.settings";
export const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, quality: "auto" };

export async function loadSettings(kv: KV): Promise<Settings> {
  try {
    const raw = await kv.get(SETTINGS_KEY);
    const o = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return {
      sound: typeof o.sound === "boolean" ? o.sound : DEFAULT_SETTINGS.sound,
      haptics: typeof o.haptics === "boolean" ? o.haptics : DEFAULT_SETTINGS.haptics,
      quality: o.quality && ["auto", "high", "mid", "low"].includes(o.quality) ? o.quality : "auto",
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export const saveSettings = (kv: KV, s: Settings): Promise<boolean> => kv.set(SETTINGS_KEY, JSON.stringify(s));
