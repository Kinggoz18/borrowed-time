/** Screen orientation preference (Settings). */
import type { OrientPref, Settings } from "../game/settings";

export async function applyOrientation(pref: OrientPref): Promise<void> {
  document.documentElement.dataset.orient = pref === "auto" ? "auto" : pref;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { ScreenOrientation } = await import("@capacitor/screen-orientation");
    if (pref === "landscape") await ScreenOrientation.lock({ orientation: "landscape" });
    else if (pref === "portrait") await ScreenOrientation.lock({ orientation: "portrait" });
    else await ScreenOrientation.unlock();
  } catch {
    /* web: CSS + manifest only */
  }
}

export function orientFromSettings(s: Settings): OrientPref {
  return s.orientation ?? "auto";
}
