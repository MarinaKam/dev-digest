import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { countBySeverity, visibleFindings } from "./helpers";

function finding(
  id: string,
  severity: FindingRecord["severity"],
  confidence = 0.9,
): FindingRecord {
  return {
    id,
    severity,
    category: "bug",
    title: `Finding ${id}`,
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "Because.",
    suggestion: null,
    confidence,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  };
}

const MIXED: FindingRecord[] = [
  finding("s1", "SUGGESTION"),
  finding("w1", "WARNING"),
  finding("c1", "CRITICAL"),
  finding("w2", "WARNING", 0.4),
  finding("w3", "WARNING"),
];

const ids = (list: FindingRecord[]) => list.map((f) => f.id);

describe("countBySeverity", () => {
  it("counts the findings of each level", () => {
    expect(countBySeverity(MIXED)).toEqual({ CRITICAL: 1, WARNING: 3, SUGGESTION: 1 });
  });

  it("reports zero for a level that has no findings", () => {
    expect(countBySeverity([finding("w1", "WARNING")])).toEqual({
      CRITICAL: 0,
      WARNING: 1,
      SUGGESTION: 0,
    });
  });

  it("reports all zeros for a run without findings", () => {
    expect(countBySeverity([])).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
  });

  it("counts low-confidence findings too", () => {
    expect(countBySeverity([finding("w1", "WARNING", 0.1)]).WARNING).toBe(1);
  });
});

describe("visibleFindings", () => {
  it("shows every finding, most severe first, when no filter is set", () => {
    expect(ids(visibleFindings(MIXED, false))).toEqual(["c1", "w1", "w2", "w3", "s1"]);
    expect(ids(visibleFindings(MIXED, false, null))).toEqual(["c1", "w1", "w2", "w3", "s1"]);
  });

  it.each([
    ["CRITICAL", ["c1"]],
    ["WARNING", ["w1", "w2", "w3"]],
    ["SUGGESTION", ["s1"]],
  ] as const)("keeps only %s findings when that level is selected", (severity, expected) => {
    expect(ids(visibleFindings(MIXED, false, severity))).toEqual(expected);
  });

  it("applies the level filter and hide-low-confidence together", () => {
    expect(ids(visibleFindings(MIXED, true, "WARNING"))).toEqual(["w1", "w3"]);
  });

  it("returns nothing when the selected level has no findings", () => {
    expect(visibleFindings([finding("w1", "WARNING")], false, "CRITICAL")).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const before = ids(MIXED);
    visibleFindings(MIXED, true, "WARNING");
    expect(ids(MIXED)).toEqual(before);
  });
});
