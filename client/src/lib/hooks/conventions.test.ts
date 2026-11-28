import { describe, it, expect } from "vitest";
import type { ConventionCandidate, ConventionList } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { applyConventionChange, conventionsPollInterval, isRunInFlight, RUNNING_POLL_MS } from "./conventions";

const base: ConventionCandidate = {
  id: "c1",
  repo_id: "r1",
  rule: "Rule one",
  evidence_path: "a.ts",
  evidence_snippet: "x",
  evidence_line_start: 1,
  evidence_line_end: 1,
  confidence: 0.9,
  accepted: false,
  status: "pending",
};
const list: ConventionList = { candidates: [base, { ...base, id: "c2", rule: "Rule two" }], last_scan: null, running: null };

describe("applyConventionChange", () => {
  it("replaces an edited or accepted candidate in place", () => {
    const next = applyConventionChange(list, { ...base, rule: "Edited", status: "accepted", accepted: true });
    expect(next.candidates.map((c) => `${c.id}:${c.rule}:${c.status}`)).toEqual(["c1:Edited:accepted", "c2:Rule two:pending"]);
    expect(list.candidates[0]?.rule).toBe("Rule one");
  });

  it("keeps a rejected candidate in place, marked rejected", () => {
    const next = applyConventionChange(list, { ...base, status: "rejected" });
    expect(next.candidates.map((c) => `${c.id}:${c.status}`)).toEqual(["c1:rejected", "c2:pending"]);
  });
});

describe("polling and the run in flight", () => {
  it("polls only while the server reports a run", () => {
    expect(conventionsPollInterval(undefined)).toBe(false);
    expect(conventionsPollInterval(list)).toBe(false);
    const running = { started_at: "2026-11-28T00:00:00Z", sampling: "spread" as const, files_sampled: null, model: null };
    expect(conventionsPollInterval({ ...list, running })).toBe(RUNNING_POLL_MS);
  });

  it("recognises only the server's extraction_running refusal", () => {
    expect(isRunInFlight(new ApiError("busy", 409, "extraction_running"))).toBe(true);
    expect(isRunInFlight(new ApiError("still cloning", 409, "conflict"))).toBe(false);
    expect(isRunInFlight(new Error("x"))).toBe(false);
  });
});
