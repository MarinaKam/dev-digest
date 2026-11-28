import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { SKILL, renderWithIntl, withIntl } from "../test-utils";

const updateMutate = vi.hoisted(() => vi.fn());
const deleteMutate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteSkill: () => ({ mutate: deleteMutate, isPending: false }),
}));

import { SkillConfigForm } from "./SkillConfigForm";

afterEach(() => {
  cleanup();
  updateMutate.mockClear();
  deleteMutate.mockClear();
  vi.restoreAllMocks();
});

const NAME = SKILL.name;

describe("SkillConfigForm", () => {
  it("shows the rule and disables Save for an invalid name", () => {
    renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    fireEvent.change(screen.getByDisplayValue(NAME), { target: { value: "Bad Name" } });

    expect(screen.getByText(/lowercase letters, digits and single dashes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeDisabled();
  });

  it("sends only the changed fields", () => {
    renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    fireEvent.change(screen.getByDisplayValue(SKILL.description), { target: { value: "Flag untested branches." } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0]?.[0]).toEqual({
      id: "sk1",
      patch: { description: "Flag untested branches." },
    });
  });

  it("does not switch a skill back on that was switched off on its card", () => {
    const { rerender } = renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    // The card toggle saved enabled=false; the query cache hands the form the new skill.
    rerender(withIntl(<SkillConfigForm skill={{ ...SKILL, enabled: false }} onDeleted={() => {}} />));
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue(SKILL.description), { target: { value: "Flag untested branches." } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    expect(updateMutate.mock.calls[0]?.[0]).toEqual({
      id: "sk1",
      patch: { description: "Flag untested branches." },
    });
  });

  it("saves the Enabled toggle at once, like the card", () => {
    renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(updateMutate.mock.calls[0]?.[0]).toEqual({ id: "sk1", patch: { enabled: false } });
  });

  it("shows the directive hint under the description", () => {
    renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    expect(screen.getByText("Write it as a directive: what the agent must do.")).toBeInTheDocument();
  });

  it("announces the new version only after the body changes", () => {
    renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    expect(screen.queryByText("Saving snapshots the body as v2")).not.toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Skill body (Markdown)"), { target: { value: "# Rule\nNew text." } });

    expect(screen.getByText("Saving snapshots the body as v2")).toBeInTheDocument();
    expect(screen.getByText("unsaved")).toBeInTheDocument();
  });

  it("shows a token estimate of the body", () => {
    renderWithIntl(<SkillConfigForm skill={{ ...SKILL, body: "abcdefgh" }} onDeleted={() => {}} />);
    expect(screen.getByText("~2 tokens")).toBeInTheDocument();
  });

  it("Cancel puts the saved values back", () => {
    renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    fireEvent.change(screen.getByDisplayValue(NAME), { target: { value: "renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByDisplayValue(NAME)).toBeInTheDocument();
  });

  it("asks for confirmation that names the agent count before deleting", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]?.[0]).toContain("2 agents use it");
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("deletes after the user confirms", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithIntl(<SkillConfigForm skill={SKILL} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    expect(deleteMutate.mock.calls[0]?.[0]).toBe("sk1");
  });
});
