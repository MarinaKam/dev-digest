import { describe, it, expect } from "vitest";
import { pullsRefetchInterval } from "./core";

describe("pullsRefetchInterval", () => {
  const row = (active_runs?: number | null) => ({ active_runs });

  it("polls fast while any PR has a review running", () => {
    expect(pullsRefetchInterval([row(0), row(2)])).toBe(4_000);
  });

  it.each([[undefined], [[]], [[row(0), row(null), row(undefined)]]])(
    "polls slowly when nothing is running (%j)",
    (rows) => {
      expect(pullsRefetchInterval(rows)).toBe(60_000);
    },
  );
});
