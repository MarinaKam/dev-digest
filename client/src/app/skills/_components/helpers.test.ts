import { describe, it, expect } from "vitest";
import { SKILL } from "./test-utils";
import {
  changedFields,
  countLines,
  estimateTokens,
  filterSkills,
  toFormValues,
  validateSkillForm,
} from "./helpers";

describe("estimateTokens", () => {
  it("is the character count over four, rounded up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("countLines", () => {
  it("counts an empty text as one line", () => {
    expect(countLines("")).toBe(1);
    expect(countLines("a\nb\nc")).toBe(3);
  });
});

describe("validateSkillForm", () => {
  const ok = toFormValues(SKILL);

  it("accepts the saved skill", () => {
    expect(validateSkillForm(ok)).toEqual({});
  });

  it("rejects a name that is not a slug", () => {
    for (const name of ["Bad Name", "-a", "a--b", "a_b", "A"]) {
      expect(validateSkillForm({ ...ok, name }).name).toBe("invalid");
    }
  });

  it("marks an empty name, description and body as empty", () => {
    expect(validateSkillForm({ ...ok, name: "", description: " ", body: "" })).toEqual({
      name: "empty",
      description: "empty",
      body: "empty",
    });
  });

  it("limits the description to 1024 and the body to 20000 characters", () => {
    expect(validateSkillForm({ ...ok, description: "d".repeat(1024) }).description).toBeUndefined();
    expect(validateSkillForm({ ...ok, description: "d".repeat(1025) }).description).toBe("tooLong");
    expect(validateSkillForm({ ...ok, body: "b".repeat(20000) }).body).toBeUndefined();
    expect(validateSkillForm({ ...ok, body: "b".repeat(20001) }).body).toBe("tooLong");
  });
});

describe("changedFields", () => {
  it("returns only the fields that differ", () => {
    const values = { ...toFormValues(SKILL), description: "New directive", enabled: false };
    expect(changedFields(SKILL, values)).toEqual({ description: "New directive", enabled: false });
  });

  it("is empty when nothing changed", () => {
    expect(changedFields(SKILL, toFormValues(SKILL))).toEqual({});
  });
});

describe("filterSkills", () => {
  it("matches the name, ignoring case", () => {
    expect(filterSkills([SKILL], "EDGE")).toHaveLength(1);
    expect(filterSkills([SKILL], "nope")).toHaveLength(0);
    expect(filterSkills([SKILL], "  ")).toHaveLength(1);
  });
});
