import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { SkillVersion } from "@devdigest/shared";
import { SKILL, renderWithIntl, withIntl } from "../test-utils";

const updateMutate = vi.hoisted(() => vi.fn());
const updateState = vi.hoisted(() => ({ isPending: false }));

const VERSIONS: SkillVersion[] = [
  { skill_id: "sk1", version: 1, body: "# Rule\nOld line", note: "Created", created_at: "2026-11-01T10:00:00.000Z" },
  { skill_id: "sk1", version: 2, body: "# Rule\nNew line", note: "Tightened scope rule", created_at: "2026-11-02T10:00:00.000Z" },
  { skill_id: "sk1", version: 3, body: "# Rule\nNew line", note: null, created_at: "2026-11-03T10:00:00.000Z" },
];

vi.mock("@/lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: updateMutate, isPending: updateState.isPending }),
}));

import { SkillVersions } from "./SkillVersions";

afterEach(() => {
  cleanup();
  updateMutate.mockClear();
  updateState.isPending = false;
});

const CURRENT = { ...SKILL, version: 3, body: "# Rule\nNew line" };

/** The list item of one version, found by its chip ("v1"). */
function rowOf(version: number): HTMLElement {
  const row = screen.getByText(`v${version}`).closest("li");
  if (!row) throw new Error(`no row for v${version}`);
  return row;
}

describe("SkillVersions", () => {
  it("lists versions newest first, with the count and a Current badge", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(screen.getByText("3 versions")).toBeInTheDocument();
    const labels = screen.getAllByText(/^v[123]$/).map((el) => el.textContent);
    expect(labels).toEqual(["v3", "v2", "v1"]);
    expect(screen.getAllByText("Current")).toHaveLength(1);
    expect(within(rowOf(3)).getByText("Current")).toBeInTheDocument();
  });

  it("offers Diff and Restore only for older versions", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(screen.getAllByRole("button", { name: "Diff" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
    expect(within(rowOf(3)).queryByRole("button")).not.toBeInTheDocument();
  });

  it("toggles an inline diff against the current body, under its row", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    fireEvent.click(within(rowOf(1)).getByRole("button", { name: "Diff" }));
    expect(within(rowOf(1)).getByText("-Old line")).toBeInTheDocument();
    expect(within(rowOf(1)).getByText("+New line")).toBeInTheDocument();

    fireEvent.click(within(rowOf(1)).getByRole("button", { name: "Hide diff" }));
    expect(screen.queryByText("-Old line")).not.toBeInTheDocument();
  });

  it("shows each version's note and a formatted date", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(within(rowOf(2)).getByText("Tightened scope rule")).toBeInTheDocument();
    expect(within(rowOf(1)).getByText("Created")).toBeInTheDocument();
    expect(within(rowOf(1)).getByText(/2026/)).toBeInTheDocument();
  });

  it("Restore saves the old body as a new version noted Restored vN", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    fireEvent.click(within(rowOf(1)).getByRole("button", { name: "Restore" }));
    expect(updateMutate.mock.calls[0]?.[0]).toEqual({
      id: "sk1",
      patch: { body: "# Rule\nOld line", version_note: "Restored v1" },
    });
  });

  it("cannot restore a version whose body is the current one", () => {
    renderWithIntl(<SkillVersions skill={CURRENT} />);
    expect(within(rowOf(2)).getByRole("button", { name: "Restore" })).toBeDisabled();
    expect(within(rowOf(1)).getByRole("button", { name: "Restore" })).not.toBeDisabled();
  });

  it("labels the restoring version's button Restoring… while the save runs", () => {
    const { rerender } = renderWithIntl(<SkillVersions skill={CURRENT} />);
    fireEvent.click(within(rowOf(1)).getByRole("button", { name: "Restore" }));
    updateState.isPending = true;
    rerender(withIntl(<SkillVersions skill={CURRENT} />));

    expect(within(rowOf(1)).getByRole("button", { name: "Restoring…" })).toBeDisabled();
    expect(within(rowOf(2)).getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });
});
