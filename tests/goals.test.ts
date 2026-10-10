import { describe, expect, it } from "vitest";
import * as E from "../src/core/engine";
import { activeGoals, GOAL_XP_PCT, GOALS } from "../src/core/goals";
import { defaultMeta } from "../src/core/save";
import { newData } from "../src/core/game";

describe("goals", () => {
  it("GOAL_XP_PCT stays zero for gate neutrality", () => {
    expect(GOAL_XP_PCT).toBe(0);
  });
  it("new game offers palisade, field and borrow", () => {
    const g = newData(3);
    const meta = defaultMeta();
    const goals = activeGoals(g.state, meta, g.events);
    expect(goals.map((x) => x.id)).toEqual(["palisade", "borrow-once", "no-grey"]);
  });
  it("completing palisade advances the list", () => {
    const g = newData(3);
    const meta = defaultMeta({ goalsDone: ["palisade"] });
    E.build(g.state, "pal", "palisade");
    const goals = activeGoals(g.state, meta, g.events);
    expect(goals[0].id).toBe("field");
  });
  it("every goal id is unique", () => {
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(GOALS.length);
  });
});
