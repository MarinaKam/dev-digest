import { describe, it, expect } from "vitest";
import { ERROR_RULE, ROUTE_RULE } from "./_components/test-utils";
import { conventionsToDraft, evidenceLabel, evidenceUrl, isValidSkillName, slugifyRule } from "./helpers";

describe("conventionsToDraft", () => {
  it("merges several conventions under <repo>-conventions with every rule and its evidence", () => {
    const draft = conventionsToDraft([ROUTE_RULE, ERROR_RULE], "payments-api");
    expect(draft.name).toBe("payments-api-conventions");
    expect(draft.description).toBe("2 house conventions extracted from payments-api");
    expect(draft.body).toContain("# payments-api-conventions");
    expect(draft.body).toContain("House conventions for `payments-api`.");
    expect(draft.body).toContain(`## ${ROUTE_RULE.rule}`);
    expect(draft.body).toContain("Detected in `src/routes/users.ts:5-6`:");
    expect(draft.body).toContain(ERROR_RULE.evidence_snippet);
  });

  it("contains only the conventions it was given", () => {
    const draft = conventionsToDraft([ERROR_RULE], "payments-api");
    expect(draft.body).not.toContain(ROUTE_RULE.rule);
    expect(draft.name).toBe("throw-notfounderror-missing-record");
    expect(draft.description).toBe(ERROR_RULE.rule);
  });

  it("fences a snippet that holds backticks with a longer fence", () => {
    const draft = conventionsToDraft([{ ...ROUTE_RULE, evidence_snippet: "const s = ```x```;" }], "api");
    expect(draft.body).toContain("````\nconst s = ```x```;\n````");
  });

  it("keeps the name a valid slug of at most 64 characters", () => {
    const draft = conventionsToDraft([ROUTE_RULE, ERROR_RULE], "A Very Long Repository Name That Goes On And On Forever");
    expect(isValidSkillName(draft.name)).toBe(true);
  });
});

describe("slugifyRule", () => {
  it("drops stop words and keeps four words", () => {
    expect(slugifyRule("Always use `zod` schemas for all route bodies")).toBe("zod-schemas-route-bodies");
    expect(slugifyRule("!!!")).toBe("convention");
  });
});

describe("evidence", () => {
  it("labels a range, one line, or the bare path", () => {
    expect(evidenceLabel(ROUTE_RULE)).toBe("src/routes/users.ts:5-6");
    expect(evidenceLabel(ERROR_RULE)).toBe("src/services/user.service.ts:3");
    expect(evidenceLabel({ ...ROUTE_RULE, evidence_line_start: null, evidence_line_end: null })).toBe(
      "src/routes/users.ts",
    );
  });

  it("links to the file on GitHub at the commit it was read at and the cited lines", () => {
    expect(evidenceUrl("acme/payments-api", "main", { ...ROUTE_RULE, evidence_sha: "c637c61" })).toBe(
      "https://github.com/acme/payments-api/blob/c637c61/src/routes/users.ts#L5-L6",
    );
  });

  it("falls back to the default branch when the commit is unknown", () => {
    expect(evidenceUrl("acme/payments-api", "main", { ...ROUTE_RULE, evidence_sha: null })).toBe(
      "https://github.com/acme/payments-api/blob/main/src/routes/users.ts#L5-L6",
    );
  });
});

describe("isValidSkillName", () => {
  it("accepts a slug and refuses anything else", () => {
    expect(isValidSkillName("repo-conventions")).toBe(true);
    for (const bad of ["", "Repo", "a--b", "-a", "a".repeat(65)]) expect(isValidSkillName(bad)).toBe(false);
  });
});
