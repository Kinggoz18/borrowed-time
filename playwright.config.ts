import { defineConfig, devices } from "@playwright/test";

// Headless Chromium renders WebGL in software (SwiftShader). Frame times recorded here are a
// sanity check that the scene runs, never a performance result. The phone is the real test.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
  },
  webServer: [
    {
      command: "npx vite --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // The production build (no perf HUD), built by `npm run build` before e2e.
      command: "npx vite preview --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    // A typical 20:9 Android phone: 360x800 CSS px at DPR 2.
    { name: "phone-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 } },
    { name: "phone-540", use: { ...devices["Desktop Chrome"], viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 } },
  ],
});
