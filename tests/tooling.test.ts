import { describe, expect, it } from "vitest";
import config from "../capacitor.config";

describe("project setup", () => {
  it("builds the web app into the folder Capacitor ships", () => {
    expect(config.webDir).toBe("dist");
    expect(config.appId).toMatch(/^[a-z]+(\.[a-z]+)+$/);
  });
});
