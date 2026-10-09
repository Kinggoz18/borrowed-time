import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "./",
  // The perf HUD ships only in dev and in the `gate` build used for the device test.
  define: { __PERF_HUD__: JSON.stringify(mode !== "production") },
  server: { host: true, port: 5191 },
  preview: { host: true, port: 4191 },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
}));
