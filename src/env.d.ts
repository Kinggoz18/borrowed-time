/// <reference types="vite/client" />
/** True in dev and in the `gate` build (device test APK); false in production. */
declare const __PERF_HUD__: boolean;

interface Window {
  /** Test and device-gate hooks: the stress scene's (src/stress.ts) or the game's (src/game/boot.ts). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __bt?: any;
}
