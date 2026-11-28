import { describe, it, expect } from "vitest";
import { runStateQueryKeys } from "./reviews";

describe("runStateQueryKeys", () => {
  it("covers the PR's own views and every PR list", () => {
    expect(runStateQueryKeys("pr-1")).toEqual([
      ["reviews", "pr-1"],
      ["pr-active-runs", "pr-1"],
      ["pr-runs", "pr-1"],
      ["pulls"],
    ]);
  });

  it("includes the PR list, so its row shows Reviewing without waiting for the next poll", () => {
    expect(runStateQueryKeys("pr-1")).toContainEqual(["pulls"]);
  });
});
