import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../test-utils";

const createMutate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate: createMutate, isPending: false, error: null }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

afterEach(() => {
  cleanup();
  createMutate.mockReset();
});

function fillValidForm() {
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "edge-case-coverage" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
    target: { value: "Flag every new branch that no test reaches." },
  });
  fireEvent.change(screen.getByLabelText("Skill body (Markdown)"), { target: { value: "# Rule\nCheck the branches." } });
}

describe("CreateSkillModal", () => {
  it("keeps Create skill disabled until the form is valid", () => {
    renderWithIntl(<CreateSkillModal onClose={() => {}} onCreated={() => {}} />);
    const submit = screen.getByRole("button", { name: "Create skill" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Bad Name" } });
    expect(submit).toBeDisabled();

    fillValidForm();
    expect(submit).not.toBeDisabled();
  });

  it("sends the form as a manual skill", () => {
    renderWithIntl(<CreateSkillModal onClose={() => {}} onCreated={() => {}} />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]?.[0]).toEqual({
      name: "edge-case-coverage",
      description: "Flag every new branch that no test reaches.",
      type: "custom",
      body: "# Rule\nCheck the branches.",
      enabled: true,
      source: "manual",
    });
  });

  it("hands the new id to onCreated and closes after a successful create", () => {
    createMutate.mockImplementation((_input, options?: { onSuccess?: (skill: { id: string }) => void }) =>
      options?.onSuccess?.({ id: "sk9" }),
    );
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderWithIntl(<CreateSkillModal onClose={onClose} onCreated={onCreated} />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    expect(onCreated).toHaveBeenCalledWith("sk9");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when nothing was created", () => {
    const onClose = vi.fn();
    renderWithIntl(<CreateSkillModal onClose={onClose} onCreated={() => {}} />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
