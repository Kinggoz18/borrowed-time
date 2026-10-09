import { defineConfig, devices } from "@playwright/test";

// Headless Chromium renders WebGL in software (SwiftShader). Frame times recorded here are a
// sanity check that the scene runs, never a performance result. The phone is the real test.
export default defineConfig({
  testDir: "e2e",
  // The stress scene and frame-time runs are paused by the owner (DECISIONS #16): RUN_STRESS=1 brings them back.
  testIgnore: process.env.RUN_STRESS === "1" ? [] : ["stress.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://127.0.0.1:5191",
    trace: "off",
    // a blocked tap fails in 30 s instead of waiting out the whole test
    actionTimeout: 30_000,
  },
  webServer: [
    {
      command: "npx vite --port 5191 --strictPort",
      url: "http://127.0.0.1:5191",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // The production build (no perf HUD), built by `npm run build` before e2e.
      command: "npx vite preview --port 4191 --strictPort",
      url: "http://127.0.0.1:4191",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    // The game is played in landscape. A typical 20:9 Android phone held sideways: 800x360 CSS px at DPR 2.
    { name: "phone-800", grepInvert: /portrait setting/, use: { ...devices["Desktop Chrome"], viewport: { width: 800, height: 360 }, deviceScaleFactor: 2 } },
    { name: "phone-960", grepInvert: /portrait setting/, use: { ...devices["Desktop Chrome"], viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 } },
    { name: "phone-portrait", grep: /portrait setting/, use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 } },
  ],
});
