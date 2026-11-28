import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";

const hooks = vi.hoisted(() => ({
  mutate: vi.fn(),
  skills: [] as Skill[],
  links: [] as AgentSkillLink[],
}));

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: hooks.skills, isLoading: false, isError: false, refetch: vi.fn() }),
  useAgentSkillLinks: () => ({ data: hooks.links, isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: hooks.mutate }),
}));

import { SkillsTab } from "./SkillsTab";

function skill(id: string, enabled = true): Skill {
  return {
    id,
    name: `skill-${id}`,
    description: "d",
    type: "rubric",
    source: "manual",
    body: "b",
    enabled,
    version: 1,
    used_by: [],
  };
}

const link = (skill_id: string, order: number): AgentSkillLink => ({ agent_id: "ag1", skill_id, order });

beforeEach(() => {
  hooks.mutate.mockReset();
  // 6 skills; a, b, c linked; b disabled globally.
  hooks.skills = [skill("a"), skill("b", false), skill("c"), skill("d"), skill("e"), skill("f")];
  hooks.links = [link("a", 0), link("b", 1), link("c", 2)];
});
afterEach(cleanup);

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <SkillsTab agentId="ag1" />
    </NextIntlClientProvider>,
  );
}

describe("SkillsTab", () => {
  it("shows linked-and-enabled over total in the badge", () => {
    renderTab();
    expect(screen.getByText("2 of 6 enabled")).toBeInTheDocument();
  });

  it("checking an unlinked skill appends it to the full ordered list", () => {
    renderTab();
    fireEvent.click(screen.getByRole("checkbox", { name: /skill-d/ }));
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["a", "b", "c", "d"] });
  });

  it("unchecking a linked skill removes it", () => {
    renderTab();
    fireEvent.click(screen.getByRole("checkbox", { name: /skill-a/ }));
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["b", "c"] });
  });

  it("keeps a globally disabled linked skill in place, dimmed, when reordering", () => {
    renderTab();
    expect(screen.getByText("off globally")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("skill-row-skill-a"), { key: "ArrowDown", altKey: true });
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["b", "a", "c"] });
  });

  it("Alt+ArrowUp moves a linked row up; the first row stays put", () => {
    renderTab();
    fireEvent.keyDown(screen.getByTestId("skill-row-skill-c"), { key: "ArrowUp", altKey: true });
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["a", "c", "b"] });
    hooks.mutate.mockReset();
    fireEvent.keyDown(screen.getByTestId("skill-row-skill-a"), { key: "ArrowUp", altKey: true });
    expect(hooks.mutate).not.toHaveBeenCalled();
  });

  it("drag and drop moves a linked row", () => {
    renderTab();
    fireEvent.dragStart(screen.getByTestId("skill-row-skill-a"));
    fireEvent.dragOver(screen.getByTestId("skill-row-skill-c"));
    fireEvent.drop(screen.getByTestId("skill-row-skill-c"));
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["b", "c", "a"] });
  });

  it("only linked rows are draggable", () => {
    renderTab();
    expect(screen.getByTestId("skill-row-skill-a")).toHaveAttribute("draggable", "true");
    expect(screen.getByTestId("skill-row-skill-d")).not.toHaveAttribute("draggable", "true");
  });

  it("filtering narrows rows but still sends the full list", () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), { target: { value: "skill-d" } });
    expect(screen.queryByTestId("skill-row-skill-a")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /skill-d/ }));
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["a", "b", "c", "d"] });
  });

  it("links to the Skills Lab when the workspace has no skills", () => {
    hooks.skills = [];
    hooks.links = [];
    renderTab();
    expect(screen.getByRole("link", { name: "Open Skills Lab" })).toHaveAttribute("href", "/skills");
  });
});
