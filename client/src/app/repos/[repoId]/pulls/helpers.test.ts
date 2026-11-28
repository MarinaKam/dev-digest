import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import {
  countBySeverity,
  filterPulls,
  formatCost,
  formatTokensCompact,
  visibleFindings,
} from "./helpers";

describe("formatCost", () => {
  it("renders an em dash when there is no cost data", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(undefined)).toBe("—");
  });

  it("renders a real zero as a price, not as missing data", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(0)).not.toBe(formatCost(null));
  });

  it.each([
    [0.0004, "$0.0004"],
    [0.000412, "$0.000412"],
    [0.0013, "$0.0013"],
    [0.014, "$0.014"],
    [0.01234, "$0.0123"],
    [0.06, "$0.060"],
    [0.5, "$0.500"],
    [0.9996, "$1.00"],
    [1.5, "$1.50"],
    [12.345, "$12.35"],
  ])("formats %s as %s", (usd, expected) => {
    expect(formatCost(usd)).toBe(expected);
  });

  it("never collapses a tiny non-zero cost to zero", () => {
    expect(formatCost(0.0004)).not.toBe("$0.000");
    expect(formatCost(0.00000123)).toBe("$0.00000123");
  });

  it("renders an em dash for a value that is not a finite, non-negative number", () => {
    expect(formatCost(Number.NaN)).toBe("—");
    expect(formatCost(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatCost(-0.01)).toBe("—");
  });
});

describe("formatTokensCompact", () => {
  it("formats in→out in thousands with one decimal", () => {
    expect(formatTokensCompact(8200, 1300)).toBe("8.2K→1.3K");
    expect(formatTokensCompact(9119, 1240)).toBe("9.1K→1.2K");
    expect(formatTokensCompact(0, 0)).toBe("0.0K→0.0K");
  });
});

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

describe("filterPulls", () => {
  const pr = (number: number, status: string, title: string, updated_at: string | null) =>
    ({ number, status, title, updated_at }) as unknown as Parameters<typeof filterPulls>[0][number];
  const pulls = [
    pr(1, "needs_review", "Add login form", "2026-06-01T00:00:00Z"),
    pr(2, "reviewed", "Fix cache key", "2026-06-03T00:00:00Z"),
    pr(13, "needs_review", "Rename helper", "2026-06-02T00:00:00Z"),
    pr(4, "merged", "No date", null),
  ];
  const numbers = (filter: Parameters<typeof filterPulls>[1]) =>
    filterPulls(pulls, filter).map((p) => p.number);

  it("keeps every status for \"all\", newest first; a PR without a date is the oldest", () => {
    expect(numbers({ status: "all", query: "", sort: "newest" })).toEqual([2, 13, 1, 4]);
  });

  it("keeps one status", () => {
    expect(numbers({ status: "needs_review", query: "", sort: "newest" })).toEqual([13, 1]);
  });

  it("orders oldest first on request", () => {
    expect(numbers({ status: "all", query: "", sort: "oldest" })).toEqual([4, 1, 13, 2]);
  });

  it("matches the title without regard to case or surrounding spaces", () => {
    expect(numbers({ status: "all", query: "  CACHE ", sort: "newest" })).toEqual([2]);
  });

  it("matches a part of the PR number", () => {
    expect(numbers({ status: "all", query: "1", sort: "newest" })).toEqual([13, 1]);
  });

  it("does not reorder the list it was given", () => {
    numbers({ status: "all", query: "", sort: "oldest" });
    expect(pulls.map((p) => p.number)).toEqual([1, 2, 13, 4]);
  });
});
