import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Perf/stress work is paused by the owner (DECISIONS #16): opt back in with RUN_STRESS=1.
    exclude: ["**/node_modules/**", ...(process.env.RUN_STRESS === "1" ? [] : ["tests/perf.test.ts"])],
    testTimeout: 60_000,
  },
});
