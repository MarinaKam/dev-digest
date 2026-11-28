import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup, within } from "@testing-library/react";
import { SKILL, renderWithIntl } from "../test-utils";
import { SkillStats } from "./SkillStats";

afterEach(cleanup);

describe("SkillStats", () => {
  it("shows the design's empty state for a skill no agent uses", () => {
    renderWithIntl(<SkillStats skill={{ ...SKILL, used_by: [] }} />);
    expect(screen.getByText("No usage yet")).toBeInTheDocument();
    expect(screen.queryByText("Agents using this skill")).not.toBeInTheDocument();
  });

  it("lists the agents that use the skill, each linked to its agent page", () => {
    renderWithIntl(<SkillStats skill={{ ...SKILL, used_by: [{ id: "a1", name: "Test Quality Reviewer" }] }} />);
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Test Quality Reviewer")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/agents/a1");
    expect(screen.queryByText("No usage yet")).not.toBeInTheDocument();
  });

  it("counts the agents in the Used by tile, singular for one", () => {
    const { unmount } = renderWithIntl(<SkillStats skill={SKILL} />);
    expect(screen.getByText("Used by").nextElementSibling).toHaveTextContent(/^2 agents$/);
    unmount();
    renderWithIntl(<SkillStats skill={{ ...SKILL, used_by: SKILL.used_by.slice(0, 1) }} />);
    expect(screen.getByText("Used by").nextElementSibling).toHaveTextContent(/^1 agent$/);
  });
});
