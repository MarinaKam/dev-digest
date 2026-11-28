import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { ERROR_RULE, ROUTE_RULE, renderWithIntl } from "../test-utils";

const createMutate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/conventions", () => ({
  useCreateConventionsSkill: () => ({ mutate: createMutate, isPending: false }),
}));

import { CreateConventionsSkillModal } from "./CreateConventionsSkillModal";

afterEach(() => {
  cleanup();
  createMutate.mockClear();
});

const ACCEPTED = [
  { ...ROUTE_RULE, status: "accepted" as const, accepted: true },
  { ...ERROR_RULE, status: "accepted" as const, accepted: true },
];

function open() {
  renderWithIntl(
    <CreateConventionsSkillModal
      repoId="r1"
      repoName="payments-api"
      conventions={ACCEPTED}
      onClose={() => {}}
      onCreated={() => {}}
    />,
  );
}

const sent = () => {
  const call = createMutate.mock.calls[0]?.[0] as { repoId: string; input: Record<string, unknown> } | undefined;
  if (!call) throw new Error("create was not called");
  return call;
};

describe("CreateConventionsSkillModal", () => {
  it("prefills the draft from the accepted conventions, as in the design", () => {
    open();
    expect(screen.getByText("Create skill from conventions")).toBeInTheDocument();
    expect(screen.getByText(/Merged from 2 accepted conventions in payments-api/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("payments-api-conventions");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
      "2 house conventions extracted from payments-api",
    );
    const body = screen.getByLabelText("Skill body (Markdown)") as HTMLTextAreaElement;
    expect(body.value).toContain(ROUTE_RULE.rule);
    expect(body.value).toContain(ERROR_RULE.rule);
    expect(screen.getByText("Saved as v1 · added to Skills Lab")).toBeInTheDocument();
  });

  it("sends the checked ids and the edited name, description and body", () => {
    open();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "repo-conventions" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "House rules." } });
    fireEvent.change(screen.getByLabelText("Skill body (Markdown)"), { target: { value: "# repo-conventions\nRules." } });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(sent()).toEqual({
      repoId: "r1",
      input: {
        convention_ids: ["c1", "c2"],
        name: "repo-conventions",
        description: "House rules.",
        body: "# repo-conventions\nRules.",
        enabled: true,
      },
    });
  });

  it("an unchecked convention leaves the draft and the request (one of several skills)", () => {
    open();
    fireEvent.click(screen.getAllByRole("checkbox")[0] as HTMLElement);
    const body = screen.getByLabelText("Skill body (Markdown)") as HTMLTextAreaElement;
    expect(body.value).not.toContain(ROUTE_RULE.rule);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("throw-notfounderror-missing-record");
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(sent().input.convention_ids).toEqual(["c2"]);
  });

  it("keeps an edited body when the selection changes", () => {
    open();
    fireEvent.change(screen.getByLabelText("Skill body (Markdown)"), { target: { value: "My own body" } });
    fireEvent.click(screen.getAllByRole("checkbox")[0] as HTMLElement);
    expect(screen.getByLabelText("Skill body (Markdown)")).toHaveValue("My own body");
  });

  it("can save the skill disabled", () => {
    open();
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(sent().input.enabled).toBe(false);
  });

  it("blocks saving with no convention, a bad name or an empty body", () => {
    open();
    const submit = () => screen.getByRole("button", { name: "Create skill" });
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Bad Name" } });
    expect(submit()).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "good-name" } });
    fireEvent.change(screen.getByLabelText("Skill body (Markdown)"), { target: { value: "  " } });
    expect(submit()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Skill body (Markdown)"), { target: { value: "body" } });
    for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
    expect(submit()).toBeDisabled();
  });

  it("the body's title follows the name the user types, until the body is edited", () => {
    open();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "repo-conventions" } });
    const body = screen.getByLabelText("Skill body (Markdown)") as HTMLTextAreaElement;
    expect(body.value.startsWith("# repo-conventions\n")).toBe(true);
    expect(body.value).not.toContain("# payments-api-conventions");
  });
});
