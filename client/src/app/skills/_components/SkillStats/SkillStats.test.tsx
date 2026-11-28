import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { SKILL, renderWithIntl } from "../test-utils";
import { SkillStats } from "./SkillStats";

afterEach(cleanup);

describe("SkillStats", () => {
  it("shows the design's empty state for a skill no agent uses", () => {
    renderWithIntl(<SkillStats skill={{ ...SKILL, used_by: [] }} />);
    expect(screen.getByText("No usage yet")).toBeInTheDocument();
    expect(screen.queryByText("Agents using this skill")).not.toBeInTheDocument();
  });

  it("lists the agents that use the skill", () => {
    renderWithIntl(<SkillStats skill={{ ...SKILL, used_by: [{ id: "a1", name: "Test Quality Reviewer" }] }} />);
    expect(screen.getByText("Test Quality Reviewer")).toBeInTheDocument();
    expect(screen.queryByText("No usage yet")).not.toBeInTheDocument();
  });
});
