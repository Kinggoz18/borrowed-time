import { Application } from "pixi.js";

async function boot(): Promise<void> {
  const host = document.getElementById("app");
  if (!host) return;
  const app = new Application();
  await app.init({ resizeTo: host, background: "#5e9a98", preference: "webgl", antialias: false });
  host.appendChild(app.canvas);
}

void boot();
