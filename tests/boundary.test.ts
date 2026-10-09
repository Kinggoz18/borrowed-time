import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("sim boundary (ESLint)", () => {
  it("src/core rejects rendering, DOM and unseeded randomness", async () => {
    const eslint = new ESLint();
    const [res] = await eslint.lintText(
      'import { Application } from "pixi.js";\nexport const a = Application;\nexport const r = Math.random();\nexport const w = window;\n',
      { filePath: "src/core/probe.ts" },
    );
    const rules = res.messages.map((m) => m.ruleId);
    expect(rules).toEqual(expect.arrayContaining(["no-restricted-imports", "no-restricted-properties", "no-restricted-globals"]));
  }, 30_000);
  it("the real src/core is clean", async () => {
    const eslint = new ESLint();
    const results = await eslint.lintFiles(["src/core/**/*.ts"]);
    expect(results.flatMap((r) => r.messages.map((m) => `${r.filePath}:${m.line} ${m.ruleId}`))).toEqual([]);
  }, 30_000);
});
