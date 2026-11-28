import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { SkillVersion } from "@devdigest/shared";
import { SKILL, renderWithIntl } from "../test-utils";

const updateMutate = vi.hoisted(() => vi.fn());

const VERSIONS: SkillVersion[] = [
  { skill_id: "sk1", version: 1, body: "# Rule\nOld line", note: "Created", created_at: "2026-11-01T10:00:00.000Z" },
  { skill_id: "sk1", version: 2, body: "# Rule\nNew line", note: "Tightened scope rule", created_at: "2026-11-02T10:00:00.000Z" },
  { skill_id: "sk1", version: 3, body: "# Rule\nNew line", note: null, created_at: "2026-11-03T10:00:00.000Z" },
];

vi.mock("@/lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: updateMutate, isPending: false }),
}));

import { SkillVersions } from "./SkillVersions";

afterEach(() => {
  cleanup();
  updateMutate.mockClear();
});

const CURRENT = { ...SKILL, version: 3, body: "# Rule\nNew line" };

describe("SkillVersions", () => {
  it("lists versions newest first, with the count and a Current badge", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(screen.getByText("3 versions")).toBeInTheDocument();
    const labels = screen.getAllByText(/^v[123]$/).map((el) => el.textContent);
    expect(labels).toEqual(["v3", "v2", "v1"]);
    expect(screen.getAllByText("Current")).toHaveLength(1);
  });

  it("offers Diff and Restore only for older versions", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(screen.getAllByRole("button", { name: "Diff" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
  });

  it("toggles an inline diff against the current body", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    fireEvent.click(screen.getByTestId("diff-v1"));
    expect(screen.getByText("-Old line")).toBeInTheDocument();
    expect(screen.getByText("+New line")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide diff" }));
    expect(screen.queryByText("-Old line")).not.toBeInTheDocument();
  });

  it("shows each version's note", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(screen.getByText("Tightened scope rule")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("Restore saves the old body as a new version noted Restored vN", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    fireEvent.click(screen.getByTestId("restore-v1"));
    expect(updateMutate.mock.calls[0]?.[0]).toEqual({
      id: "sk1",
      patch: { body: "# Rule\nOld line", version_note: "Restored v1" },
    });
  });

  it("cannot restore a version whose body is the current one", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(screen.getByTestId("restore-v2")).toBeDisabled();
    expect(screen.getByTestId("restore-v1")).not.toBeDisabled();
  });
});
