import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { Skill } from "@devdigest/shared";
import { SKILL, renderWithIntl } from "../test-utils";

const refetch = vi.hoisted(() => vi.fn());
const skillsState = vi.hoisted(() => ({
  data: undefined as Skill[] | undefined,
  isLoading: false,
  isError: false,
}));

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ ...skillsState, refetch }),
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillList } from "./SkillList";

const OTHER: Skill = { ...SKILL, id: "sk2", name: "naming-rules", used_by: [] };

afterEach(() => {
  cleanup();
  refetch.mockClear();
  skillsState.data = undefined;
  skillsState.isLoading = false;
  skillsState.isError = false;
});

function renderList(handlers: { onCreate?: () => void; onImport?: () => void } = {}) {
  const { container } = renderWithIntl(
    <SkillList
      activeId={null}
      onSelect={() => {}}
      onCreate={handlers.onCreate ?? (() => {})}
      onImport={handlers.onImport ?? (() => {})}
    />,
  );
  return container;
}

describe("SkillList", () => {
  it("shows skeletons while the skills load", () => {
    skillsState.isLoading = true;
    const container = renderList();
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("No skills yet")).not.toBeInTheDocument();
  });

  it("shows an error with a retry that refetches", () => {
    skillsState.isError = true;
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load skills.");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state whose call to action creates a skill", () => {
    skillsState.data = [];
    const onCreate = vi.fn();
    renderList({ onCreate });
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create from scratch" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("filters by name and says when nothing matches", () => {
    skillsState.data = [SKILL, OTHER];
    renderList();
    const search = screen.getByRole("textbox", { name: "Search skills by name" });

    fireEvent.change(search, { target: { value: "NAMING" } });
    expect(screen.getByRole("button", { name: "naming-rules" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "edge-case-coverage" })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No matching skills")).toBeInTheDocument();
    expect(screen.queryByText("No skills yet")).not.toBeInTheDocument();
  });

  it("the Add Skill menu opens the create and the import flows", () => {
    skillsState.data = [SKILL];
    const onCreate = vi.fn();
    const onImport = vi.fn();
    renderList({ onCreate, onImport });

    fireEvent.click(screen.getByRole("button", { name: "Add Skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Create from scratch" }));
    expect(onCreate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Add Skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Import from file" }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
