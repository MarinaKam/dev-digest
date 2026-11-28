import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { Skill } from "@devdigest/shared";
import { SKILL, renderWithIntl } from "../test-utils";

const setParam = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => new Map<string, string>());
const skillsState = vi.hoisted(() => ({
  data: undefined as Skill[] | undefined,
  isLoading: false,
  isError: false,
}));

vi.mock("@/lib/query-params", () => ({
  useQueryParams: () => ({ get: (key: string) => params.get(key) ?? null, set: setParam }),
}));
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ ...skillsState, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// The editor has its own tests; here it only shows what the view handed it.
vi.mock("../SkillEditor", () => ({
  SkillEditor: (props: { skillId: string; tab: string; onDeleted: (id: string) => void }) => (
    <section aria-label="editor">
      <span>{`editing ${props.skillId} on ${props.tab}`}</span>
      <button type="button" onClick={() => props.onDeleted(props.skillId)}>
        mock delete
      </button>
    </section>
  ),
}));

import { SkillsView } from "./SkillsView";

const SECOND: Skill = { ...SKILL, id: "sk2", name: "naming-rules" };

afterEach(() => {
  cleanup();
  setParam.mockClear();
  params.clear();
  skillsState.data = undefined;
  skillsState.isLoading = false;
  skillsState.isError = false;
});

describe("SkillsView", () => {
  it("opens the skill named in ?skill", () => {
    skillsState.data = [SKILL, SECOND];
    params.set("skill", "sk2");
    renderWithIntl(<SkillsView />);
    expect(screen.getByText("editing sk2 on config")).toBeInTheDocument();
  });

  it("falls back to the first skill when ?skill is missing or unknown", () => {
    skillsState.data = [SKILL, SECOND];
    params.set("skill", "gone");
    renderWithIntl(<SkillsView />);
    expect(screen.getByText("editing sk1 on config")).toBeInTheDocument();
  });

  it("keeps a known ?tab and replaces an unknown one with the default", () => {
    skillsState.data = [SKILL];
    params.set("tab", "versions");
    const { unmount } = renderWithIntl(<SkillsView />);
    expect(screen.getByText("editing sk1 on versions")).toBeInTheDocument();
    unmount();

    params.set("tab", "nonsense");
    renderWithIntl(<SkillsView />);
    expect(screen.getByText("editing sk1 on config")).toBeInTheDocument();
  });

  it("selects another skill after the open one is deleted", () => {
    skillsState.data = [SKILL, SECOND];
    renderWithIntl(<SkillsView />);
    fireEvent.click(screen.getByRole("button", { name: "mock delete" }));
    expect(setParam).toHaveBeenCalledWith("skill", "sk2");
  });

  it("clears the selection after the last skill is deleted", () => {
    skillsState.data = [SKILL];
    renderWithIntl(<SkillsView />);
    fireEvent.click(screen.getByRole("button", { name: "mock delete" }));
    expect(setParam).toHaveBeenCalledWith("skill", null);
  });

  it("shows a skeleton in the editor pane while the skills load", () => {
    skillsState.isLoading = true;
    renderWithIntl(<SkillsView />);
    expect(screen.getByTestId("skill-editor-loading")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "editor" })).not.toBeInTheDocument();
  });

  it("leaves the editor pane blank when the list failed to load: the list shows the error once", () => {
    skillsState.isError = true;
    renderWithIntl(<SkillsView />);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "editor" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("skill-editor-loading")).not.toBeInTheDocument();
  });

  it("leaves the editor pane blank when there are no skills: the list shows the empty state", () => {
    skillsState.data = [];
    renderWithIntl(<SkillsView />);
    expect(screen.getAllByText("No skills yet")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "editor" })).not.toBeInTheDocument();
  });
});
