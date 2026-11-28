import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";
import skillsMessages from "../../../../../../../../messages/en/skills.json";

const hooks = vi.hoisted(() => ({
  mutate: vi.fn(),
  pending: false,
  skills: [] as Skill[],
  links: [] as AgentSkillLink[],
  failed: false,
  params: {} as Record<string, string>,
  setParam: vi.fn(),
}));

vi.mock("@/lib/query-params", async () => {
  const React = await import("react");
  return {
    useQueryParams: () => {
      const [, bump] = React.useReducer((n: number) => n + 1, 0);
      return {
        get: (key: string) => hooks.params[key] ?? null,
        set: (key: string, value: string | null) => {
          hooks.setParam(key, value);
          if (value == null) delete hooks.params[key];
          else hooks.params[key] = value;
          bump();
        },
      };
    },
  };
});

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: hooks.skills, isLoading: false, isError: false, refetch: vi.fn() }),
  useAgentSkillLinks: () => ({ data: hooks.links, isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: hooks.mutate, isPending: hooks.pending, isError: hooks.failed }),
}));

import { SkillsTab } from "./SkillsTab";
import * as barrel from "./index";

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
    injection_flags: [],
    used_by: [],
  };
}

const link = (skill_id: string, order: number): AgentSkillLink => ({ agent_id: "ag1", skill_id, order });

beforeEach(() => {
  hooks.mutate.mockReset();
  hooks.pending = false;
  hooks.failed = false;
  hooks.params = {};
  hooks.setParam.mockReset();
  // 6 skills; a, b, c linked; b disabled globally.
  hooks.skills = [skill("a"), skill("b", false), skill("c"), skill("d"), skill("e"), skill("f")];
  hooks.links = [link("a", 0), link("b", 1), link("c", 2)];
});
afterEach(cleanup);

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages, skills: skillsMessages }}>
      <SkillsTab agentId="ag1" />
    </NextIntlClientProvider>,
  );
}

describe("SkillsTab", () => {
  it("exports the component by name only, not as default", () => {
    expect(barrel.SkillsTab).toBe(SkillsTab);
    expect("default" in barrel).toBe(false);
  });

  it("shows linked-and-enabled over total in the badge", () => {
    renderTab();
    expect(screen.getByText("2 of 6 enabled")).toBeInTheDocument();
  });

  it("tints each type badge with its type colour, as in the design", () => {
    hooks.skills = [{ ...skill("a"), type: "security" }, skill("c")];
    hooks.links = [link("a", 0)];
    renderTab();
    expect(screen.getByText("security")).toHaveStyle({ color: "var(--crit)" });
    expect(screen.getByText("rubric")).toHaveStyle({ color: "var(--accent)" });
  });

  it("takes no new change while the last one is being saved", () => {
    hooks.pending = true;
    renderTab();
    fireEvent.keyDown(screen.getByTestId("skill-row-skill-a"), { key: "ArrowDown", altKey: true });
    expect(hooks.mutate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Use skill-d in this agent")).toBeDisabled();
  });

  it("checking an unlinked skill appends it to the full ordered list", () => {
    renderTab();
    fireEvent.click(screen.getByRole("switch", { name: /skill-d/ }));
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["a", "b", "c", "d"] });
  });

  it("unchecking a linked skill removes it", () => {
    renderTab();
    fireEvent.click(screen.getByRole("switch", { name: /skill-a/ }));
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["b", "c"] });
  });

  it("dims a globally disabled linked row and keeps it in place when reordering", () => {
    renderTab();
    expect(screen.getByText("off globally")).toBeInTheDocument();
    expect(screen.getByTestId("skill-row-skill-b")).toHaveStyle({ opacity: "0.55" });
    expect(screen.getByTestId("skill-row-skill-a")).toHaveStyle({ opacity: "1" });
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
    fireEvent.dragStart(screen.getByTestId("skill-row-skill-a"), {
      dataTransfer: { setData: vi.fn(), effectAllowed: "" },
    });
    fireEvent.dragOver(screen.getByTestId("skill-row-skill-c"));
    fireEvent.drop(screen.getByTestId("skill-row-skill-c"));
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["b", "c", "a"] });
  });

  it("puts data on the drag, which Firefox needs to start one", () => {
    renderTab();
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByTestId("skill-row-skill-a"), {
      dataTransfer: { setData, effectAllowed: "" },
    });
    expect(setData).toHaveBeenCalledWith("text/plain", "a");
  });

  it("only linked rows are draggable", () => {
    renderTab();
    expect(screen.getByTestId("skill-row-skill-a")).toHaveAttribute("draggable", "true");
    expect(screen.getByTestId("skill-row-skill-d")).not.toHaveAttribute("draggable", "true");
  });

  it("filtering narrows rows, keeps the filter in the URL and still sends the full list", () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), { target: { value: "skill-d" } });
    expect(hooks.setParam).toHaveBeenCalledWith("skillsQ", "skill-d");
    expect(screen.queryByTestId("skill-row-skill-a")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: /skill-d/ }));
    expect(hooks.mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["a", "b", "c", "d"] });
  });

  it("reads the filter from the URL", () => {
    hooks.params = { skillsQ: "skill-e" };
    renderTab();
    expect(screen.getByTestId("skill-row-skill-e")).toBeInTheDocument();
    expect(screen.queryByTestId("skill-row-skill-a")).not.toBeInTheDocument();
  });

  it("clearing the filter removes it from the URL", () => {
    hooks.params = { skillsQ: "skill-e" };
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), { target: { value: "" } });
    expect(hooks.setParam).toHaveBeenCalledWith("skillsQ", null);
  });

  it("ignores a link whose skill is missing when moving and saving", () => {
    hooks.links = [link("a", 0), link("ghost", 1), link("b", 2), link("c", 3)];
    renderTab();
    fireEvent.keyDown(screen.getByTestId("skill-row-skill-a"), { key: "ArrowDown", altKey: true });
    expect(hooks.mutate).toHaveBeenLastCalledWith({ agentId: "ag1", skillIds: ["b", "a", "c"] });
    fireEvent.click(screen.getByRole("switch", { name: /skill-d/ }));
    expect(hooks.mutate).toHaveBeenLastCalledWith({ agentId: "ag1", skillIds: ["a", "b", "c", "d"] });
  });

  it("tells the user when a change was not saved", () => {
    hooks.failed = true;
    renderTab();
    expect(screen.getByRole("alert")).toHaveTextContent("Your change was not saved");
  });

  it("shows no save error while nothing failed", () => {
    renderTab();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("links to the Skills Lab when the workspace has no skills", () => {
    hooks.skills = [];
    hooks.links = [];
    renderTab();
    expect(screen.getByRole("link", { name: "Open Skills Lab" })).toHaveAttribute("href", "/skills");
  });
});
