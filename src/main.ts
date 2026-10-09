// Entry: the game, or the Phase 0 stress scene for the device perf gate (`?stress=1`).
const params = new URLSearchParams(location.search);
const start = params.has("stress") ? import("./stress").then((m) => m.bootStress()) : import("./game/boot").then((m) => m.bootGame());
start.catch((e: unknown) => {
  (window as unknown as { __bt?: { error?: string } }).__bt = { ...((window as unknown as { __bt?: object }).__bt ?? {}), error: String(e) };
  console.error(e);
});
