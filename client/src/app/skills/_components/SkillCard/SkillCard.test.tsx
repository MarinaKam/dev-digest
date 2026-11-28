import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { SKILL, renderWithIntl } from "../test-utils";

const updateMutate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: updateMutate, isPending: false }),
}));

import { SkillCard } from "./SkillCard";

afterEach(() => {
  cleanup();
  updateMutate.mockClear();
});

describe("SkillCard", () => {
  it("shows name, description, type, source and the agent count", () => {
    renderWithIntl(<SkillCard skill={SKILL} onSelect={() => {}} />);
    expect(screen.getByText("edge-case-coverage")).toBeInTheDocument();
    expect(screen.getByText(SKILL.description)).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
  });

  it("uses the singular for one agent", () => {
    renderWithIntl(<SkillCard skill={{ ...SKILL, used_by: SKILL.used_by.slice(0, 1) }} onSelect={() => {}} />);
    expect(screen.getByText("1 agent")).toBeInTheDocument();
  });

  it("selects the skill when the card is clicked", () => {
    const onSelect = vi.fn();
    renderWithIntl(<SkillCard skill={SKILL} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "edge-case-coverage" }));
    expect(onSelect).toHaveBeenCalledWith("sk1");
  });

  it("the toggle updates enabled and does not select the card", () => {
    const onSelect = vi.fn();
    renderWithIntl(<SkillCard skill={SKILL} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("switch"));

    expect(updateMutate).toHaveBeenCalledWith({ id: "sk1", patch: { enabled: false } });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
