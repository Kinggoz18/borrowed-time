/**
 * Ada's list: three live goals from state (no XP; presentation and meta only).
 */
import * as E from "./engine";
import { type BType } from "./rules";
import type { IslandState } from "./state";
import type { SaveMeta } from "./save";
import type { LoggedEvent } from "./game";

export const GOAL_XP_PCT = 0;

export interface GoalDef {
  id: string;
  order: number;
  tierMax: number;
  title: string;
  ada: string;
  prereq?: string[];
  done: (st: IslandState, meta: SaveMeta, events: readonly LoggedEvent[]) => boolean;
}

const hasB = (st: IslandState, t: BType) => E.blds(st).some(([, b]) => b.type === t);
const bLevel = (st: IslandState, t: BType) => E.blds(st).find(([, b]) => b.type === t)?.[1]?.n ?? 0;

export const GOALS: GoalDef[] = [
  {
    id: "palisade",
    order: 10,
    tierMax: 3,
    title: "Raise the Palisade",
    ada: "Walls before whispers on the water.",
    done: (st) => hasB(st, "palisade"),
  },
  {
    id: "field",
    order: 20,
    tierMax: 3,
    title: "Plant a Field",
    ada: "Nobody eats a wall. Raise a Field.",
    prereq: ["palisade"],
    done: (st) => hasB(st, "field"),
  },
  {
    id: "borrow-once",
    order: 30,
    tierMax: 3,
    title: "Borrow light once",
    ada: "Ask Hesper for tomorrow's hours.",
    done: (st) => st.stats.borrowed > 0,
  },
  {
    id: "repay-zero",
    order: 40,
    tierMax: 3,
    title: "Pay Hesper to zero once",
    ada: "Bring the ledger home before dusk.",
    prereq: ["borrow-once"],
    done: (st, _m, evs) => evs.some((e) => e.kind === "repaid" && e.cleared) || (st.stats.repaid > 0 && st.debt === 0),
  },
  {
    id: "tower",
    order: 50,
    tierMax: 3,
    title: "Build a Watchtower",
    ada: "Someone should call the noon.",
    prereq: ["field"],
    done: (st) => hasB(st, "tower"),
  },
  {
    id: "hold-walls",
    order: 60,
    tierMax: 3,
    title: "Hold a night at the walls",
    ada: "Everyone on the ring when the boats come.",
    prereq: ["palisade"],
    done: (_st, _m, evs) => evs.some((e) => e.kind === "raid" && e.result && !("quiet" in e.result && e.result.quiet) && e.result.won),
  },
  {
    id: "field-look",
    order: 70,
    tierMax: 3,
    title: "Raise a Field to its second look",
    ada: "Let the moss show on the rows.",
    prereq: ["field"],
    done: (st) => bLevel(st, "field") >= 3,
  },
  {
    id: "food-homes",
    order: 80,
    tierMax: 3,
    title: "Have Food 20 and Homes 20",
    ada: "Full bellies and roofs before the next age.",
    prereq: ["cottage"],
    done: (st) => Math.floor(E.food(st)) >= 20 && E.popRoom(st) >= 20,
  },
  {
    id: "no-grey",
    order: 90,
    tierMax: 3,
    title: "Spend a day with no grey land",
    ada: "Pay the shore back its colour.",
    done: (st) => E.greyCount(st) === 0 && st.stats.borrowed > 0,
  },
  {
    id: "caravan",
    order: 100,
    tierMax: 3,
    title: "Send a caravan",
    ada: "Let the boats carry our Hours away and back.",
    prereq: ["field"],
    done: (_st, _m, evs) => evs.some((e) => e.kind === "caravan"),
  },
  {
    id: "cottage",
    order: 110,
    tierMax: 3,
    title: "Raise a Cottage",
    ada: "Give the families a door.",
    prereq: ["field"],
    done: (st) => hasB(st, "cottage"),
  },
];

export interface ActiveGoal {
  id: string;
  title: string;
  ada: string;
}

export function activeGoals(st: IslandState, meta: SaveMeta, events: readonly LoggedEvent[]): ActiveGoal[] {
  const done = new Set(meta.goalsDone);
  const out: ActiveGoal[] = [];
  const sorted = GOALS.filter((g) => st.tier <= g.tierMax).sort((a, b) => a.order - b.order);
  for (const g of sorted) {
    if (done.has(g.id)) continue;
    if (g.prereq?.some((p) => !done.has(p))) continue;
    if (g.done(st, meta, events)) continue;
    out.push({ id: g.id, title: g.title, ada: g.ada });
    if (out.length >= 3) break;
  }
  return out;
}

export function newlyCompletedGoals(st: IslandState, meta: SaveMeta, events: readonly LoggedEvent[]): GoalDef[] {
  const done = new Set(meta.goalsDone);
  return GOALS.filter((g) => !done.has(g.id) && g.done(st, meta, events));
}

export function markGoalsComplete(meta: SaveMeta, completed: GoalDef[]): void {
  for (const g of completed) {
    if (!meta.goalsDone.includes(g.id)) meta.goalsDone.push(g.id);
  }
}
