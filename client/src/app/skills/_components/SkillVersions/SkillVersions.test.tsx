import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { SkillVersion } from "@devdigest/shared";
import { SKILL, renderWithIntl } from "../test-utils";

const updateMutate = vi.hoisted(() => vi.fn());

const VERSIONS: SkillVersion[] = [
  { skill_id: "sk1", version: 1, body: "# Rule\nOld line", created_at: "2026-11-01T10:00:00.000Z" },
  { skill_id: "sk1", version: 2, body: "# Rule\nNew line", created_at: "2026-11-02T10:00:00.000Z" },
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

const CURRENT = { ...SKILL, version: 2, body: "# Rule\nNew line" };

describe("SkillVersions", () => {
  it("lists versions newest first, with the count and a Current badge", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(screen.getByText("2 versions")).toBeInTheDocument();
    const labels = screen.getAllByText(/^v[12]$/).map((el) => el.textContent);
    expect(labels).toEqual(["v2", "v1"]);
    expect(screen.getAllByText("Current")).toHaveLength(1);
  });

  it("offers Diff and Restore only for older versions", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(screen.getAllByRole("button", { name: "Diff" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(1);
  });

  it("toggles an inline diff against the current body", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    fireEvent.click(screen.getByRole("button", { name: "Diff" }));
    expect(screen.getByText("-Old line")).toBeInTheDocument();
    expect(screen.getByText("+New line")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide diff" }));
    expect(screen.queryByText("-Old line")).not.toBeInTheDocument();
  });

  it("Restore saves the old body through the update hook", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(updateMutate.mock.calls[0]?.[0]).toEqual({ id: "sk1", patch: { body: "# Rule\nOld line" } });
  });
});
