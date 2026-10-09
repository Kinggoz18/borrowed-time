import { defineConfig } from "vitest/config";

// The sim gates: slow (minutes), so separate from `npm test`. CI runs both.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/sim/**/*.sim.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 900_000,
  },
});
