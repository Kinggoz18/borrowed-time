/**
 * One play session: the island's GameData, the in-game clock and saving. No DOM, no Pixi: the UI
 * listens for events and the renderer reads `state`. Every change goes through dispatch(), so the
 * command log always reproduces the island.
 */
import { CommandError, dispatch, newData, type Command, type GameData, type GameEvent } from "../core/game";
import { decodeSave, encodeSave, SAVE_KEY, type SaveMeta } from "../core/save";
import type { IslandState } from "../core/state";
import type { KV } from "../platform/storage";

/** Real milliseconds per in-game hour at 1× (FINAL_PLAN_BT.md §2: a day is about half a minute). */
export const HOUR_MS = 2500;
export const FAST = 8;

export type Listener = (evs: GameEvent[], cmd: Command) => void;

export class Session {
  speed = 1;
  /** Paused while a card or sheet that needs an answer is open, and while a raid plays. */
  paused = false;
  private acc = 0;
  private listeners: Listener[] = [];
  lastSaveOk = true;

  constructor(
    public data: GameData,
    public meta: SaveMeta,
    private kv: KV,
    private now: () => number = () => Date.now(),
  ) {}

  static fresh(seed: number, kv: KV, colonyName: string, now?: () => number): Session {
    return new Session(newData(seed), { introDone: false, colonyName, savedAt: 0 }, kv, now);
  }
  static async load(kv: KV, now?: () => number): Promise<Session | null> {
    const f = decodeSave(await kv.get(SAVE_KEY));
    return f ? new Session(f.data, f.meta, kv, now) : null;
  }

  get state(): IslandState {
    return this.data.state;
  }
  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  /** Applies a command. Returns its events, or null when the rules refuse it (nothing changes). */
  do(cmd: Command): GameEvent[] | null {
    let evs: GameEvent[];
    try {
      evs = dispatch(this.data, cmd);
    } catch (e) {
      if (e instanceof CommandError) return null;
      throw e;
    }
    for (const l of this.listeners) l(evs, cmd);
    // save at every phase change and every in-game hour; cheap (a few KB)
    void this.save();
    return evs;
  }

  /** Advances the clock by real time; ticks whole in-game hours while it is day. */
  update(dtMs: number): void {
    if (this.paused || this.state.phase !== "day") {
      this.acc = 0;
      return;
    }
    this.acc += dtMs * this.speed;
    while (this.acc >= HOUR_MS && this.state.phase === "day" && !this.paused) {
      this.acc -= HOUR_MS;
      this.do({ t: "hour" });
    }
  }
  /** 0..1 through today's light, smooth between hours. */
  dayProgress(): number {
    const st = this.state;
    return Math.min(1, (st.hour + (st.phase === "day" ? this.acc / HOUR_MS : 0)) / st.dayLen);
  }

  async save(): Promise<boolean> {
    this.meta.savedAt = this.now();
    this.lastSaveOk = await this.kv.set(SAVE_KEY, encodeSave(this.data, this.meta));
    return this.lastSaveOk;
  }
}
