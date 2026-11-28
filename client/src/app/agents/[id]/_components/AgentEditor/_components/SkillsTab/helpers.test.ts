import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { countEnabledLinked, matchesQuery, moveLinked, orderedRows } from "./helpers";

function skill(id: string, name: string, enabled = true): Skill {
  return {
    id,
    name,
    description: "d",
    type: "rubric",
    source: "manual",
    body: "b",
    enabled,
    version: 1,
    injection_flags: [],
    used_by: [],
  };
}

const A = skill("a", "alpha");
const B = skill("b", "bravo");
const C = skill("c", "charlie");
const D = skill("d", "delta");

describe("orderedRows", () => {
  it("puts linked skills first in link order, then unlinked by name", () => {
    const rows = orderedRows([D, A, C, B], ["c", "a"]);
    expect(rows.map((r) => [r.skill.id, r.linked])).toEqual([
      ["c", true],
      ["a", true],
      ["b", false],
      ["d", false],
    ]);
  });

  it("drops a linked id that has no skill", () => {
    expect(orderedRows([A], ["gone", "a"]).map((r) => r.skill.id)).toEqual(["a"]);
  });

  it("does not mutate its input", () => {
    const skills = [D, A];
    orderedRows(skills, []);
    expect(skills).toEqual([D, A]);
  });
});

describe("moveLinked", () => {
  it("moves an item down and up", () => {
    expect(moveLinked(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveLinked(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("returns an unchanged copy for out-of-range or equal indexes", () => {
    const ids = ["a", "b"];
    expect(moveLinked(ids, 0, 2)).toEqual(["a", "b"]);
    expect(moveLinked(ids, -1, 0)).toEqual(["a", "b"]);
    expect(moveLinked(ids, 1, 1)).toEqual(["a", "b"]);
    expect(moveLinked(ids, 0, 2)).not.toBe(ids);
  });
});

describe("countEnabledLinked / matchesQuery", () => {
  it("counts linked skills that are enabled globally", () => {
    expect(countEnabledLinked([A, skill("b", "bravo", false), C], ["a", "b"])).toBe(1);
  });

  it("filters by name, case-insensitively", () => {
    expect(matchesQuery(A, "ALP")).toBe(true);
    expect(matchesQuery(A, "zzz")).toBe(false);
    expect(matchesQuery(A, "  ")).toBe(true);
  });
});
