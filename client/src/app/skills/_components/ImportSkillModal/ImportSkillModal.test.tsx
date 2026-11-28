import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { SkillImportPreview } from "@devdigest/shared";
import { renderWithIntl } from "../test-utils";

const previewMutate = vi.hoisted(() => vi.fn());
const createMutate = vi.hoisted(() => vi.fn());
const previewState = vi.hoisted(() => ({ data: undefined as unknown, error: null as Error | null }));

vi.mock("@/lib/hooks/skills", () => ({
  useImportPreview: () => ({
    mutate: previewMutate,
    data: previewState.data,
    error: previewState.error,
    isPending: false,
  }),
  useCreateSkill: () => ({ mutate: createMutate, isPending: false, error: null }),
}));

import { ImportSkillModal } from "./ImportSkillModal";

const PREVIEW: SkillImportPreview = {
  draft: {
    name: "edge-case-coverage",
    description: "Flag every new branch that no test reaches.",
    type: "custom",
    body: "# Rule\nCheck the branches.",
    source: "imported_file",
  },
  core_path: "SKILL.md",
  skipped_files: [
    { path: "scripts/run.sh", reason: "not_markdown" },
    { path: "NOTES.md", reason: "extra_markdown" },
  ],
  ignored_keys: ["license"],
  unreadable_keys: [{ key: "tags", line: 4, reason: "flow lists are not read" }],
  warnings: ["The body is longer than 20,000 characters."],
};

afterEach(() => {
  cleanup();
  previewMutate.mockClear();
  createMutate.mockClear();
  previewState.data = undefined;
  previewState.error = null;
});

function open() {
  renderWithIntl(<ImportSkillModal onClose={() => {}} onCreated={() => {}} />);
}

describe("ImportSkillModal", () => {
  it("asks for a preview when a file is chosen, and does not create anything", () => {
    open();
    const file = new File(["# x"], "skill.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("Skill file (.md or .zip)"), { target: { files: [file] } });

    expect(previewMutate).toHaveBeenCalledTimes(1);
    expect(previewMutate.mock.calls[0]?.[0]).toBe(file);
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("accepts .md and .zip files", () => {
    open();
    expect(screen.getByLabelText("Skill file (.md or .zip)")).toHaveAttribute("accept", ".md,.zip");
  });

  it("lists skipped files, unreadable keys, warnings and the trust warning", () => {
    previewState.data = PREVIEW;
    open();

    expect(screen.getAllByText("skipped, not executed")).toHaveLength(2);
    expect(screen.getByText("scripts/run.sh")).toBeInTheDocument();
    expect(screen.getByText("not a Markdown file")).toBeInTheDocument();
    expect(screen.getByText("tags (line 4): flow lists are not read")).toBeInTheDocument();
    expect(screen.getByText(/license/)).toBeInTheDocument();
    expect(screen.getByText("The body is longer than 20,000 characters.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "An imported skill is somebody else's instructions inside your agent's prompt. Read the body before you save it.",
      ),
    ).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("creates the skill only on Save skill, with source imported_file", () => {
    previewState.data = PREVIEW;
    open();
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]?.[0]).toEqual({
      name: "edge-case-coverage",
      description: "Flag every new branch that no test reaches.",
      type: "custom",
      body: "# Rule\nCheck the branches.",
      source: "imported_file",
      version_note: "Imported from SKILL.md",
    });
  });

  it("sends the draft as the user edited it", () => {
    previewState.data = PREVIEW;
    open();
    fireEvent.change(screen.getByDisplayValue("edge-case-coverage"), { target: { value: "renamed-skill" } });
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(createMutate.mock.calls[0]?.[0]).toMatchObject({ name: "renamed-skill", source: "imported_file" });
  });

  it("disables Save skill while the draft is invalid", () => {
    previewState.data = { ...PREVIEW, draft: { ...PREVIEW.draft, description: "" } };
    open();
    expect(screen.getByRole("button", { name: "Save skill" })).toBeDisabled();
  });

  it("shows a server error readably", () => {
    previewState.error = new Error("The file is larger than 1 MiB");
    open();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not read the file: The file is larger than 1 MiB");
  });
});
