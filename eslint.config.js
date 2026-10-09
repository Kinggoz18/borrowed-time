import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "android", "ios", "public", "playwright-report", "test-results", ".artifacts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { window: "readonly", Buffer: "readonly", console: "readonly", process: "readonly" } },
  },
  {
    // The rules are pure: no rendering, DOM, storage or platform code may leak into src/core.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["pixi.js", "pixi-filters", "@capacitor/*", "gsap", "howler"], message: "src/core is pure: no rendering or platform imports." },
        { group: ["../*", "!../core/*"], message: "src/core may only import from src/core." },
      ] }],
      "no-restricted-globals": ["error", "window", "document", "localStorage", "sessionStorage", "navigator", "performance", "requestAnimationFrame", "setTimeout", "setInterval", "fetch"],
      "no-restricted-properties": ["error", { object: "Math", property: "random", message: "Use the seeded rng." }, { object: "Date", property: "now", message: "The rules have no clock." }],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
