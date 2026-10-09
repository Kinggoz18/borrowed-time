/**
 * Append-only command log. The stress scene has no game rules, so its commands are scenario
 * switches (quality tier, run mode, crowd on/off, cinematic). The shape matches the plan's
 * multiplayer-ready log: intents with sequence numbers, never results.
 */
export type Command =
  | { kind: "setTier"; tier: "low" | "mid" | "high"; reason: "auto" | "manual" | "drop" }
  | { kind: "setMode"; mode: "loop" | "worst" | "throttle" }
  | { kind: "setCrowd"; on: boolean }
  | { kind: "cinematic" }
  | { kind: "raid"; on: boolean };

export interface LoggedCommand {
  seq: number;
  atMs: number;
  command: Command;
}

export class CommandLog {
  private readonly entries: LoggedCommand[] = [];
  append(command: Command, atMs: number): LoggedCommand {
    const last = this.entries[this.entries.length - 1];
    if (last && atMs < last.atMs) throw new Error("command log is append-only in time");
    const entry = Object.freeze({ seq: this.entries.length + 1, atMs, command: Object.freeze({ ...command }) });
    this.entries.push(entry);
    return entry;
  }
  all(): readonly LoggedCommand[] {
    return this.entries;
  }
  /** Commands with atMs in [fromMs, toMs). */
  between(fromMs: number, toMs: number): LoggedCommand[] {
    return this.entries.filter((e) => e.atMs >= fromMs && e.atMs < toMs);
  }
}

export function describeCommand(c: Command): string {
  switch (c.kind) {
    case "setTier":
      return `tier ${c.tier} (${c.reason})`;
    case "setMode":
      return `mode ${c.mode}`;
    case "setCrowd":
      return `crowd ${c.on ? "on" : "off"}`;
    case "cinematic":
      return "era cinematic";
    case "raid":
      return `raid ${c.on ? "start" : "end"}`;
  }
}
