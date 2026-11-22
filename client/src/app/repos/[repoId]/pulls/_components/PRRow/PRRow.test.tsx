import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import type { FindingRecord, ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

const push = vi.hoisted(() => vi.fn());
const usePrReviews = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/hooks/reviews", () => ({ usePrReviews }));

import { PRRow } from "./PRRow";

beforeEach(() => {
  push.mockClear();
  usePrReviews.mockReset();
  usePrReviews.mockReturnValue({ data: undefined });
});
afterEach(cleanup);

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr-1",
    number: 455,
    title: "Webhook retry with exponential backoff",
    author: "tomek.w",
    branch: "feat/retry",
    base: "main",
    head_sha: "sha",
    additions: 200,
    deletions: 40,
    files_count: 6,
    status: "needs_review",
    updated_at: "2026-06-01T09:00:00.000Z",
    score: 68,
    ...o,
  };
}

function renderRow(meta: PrMeta) {
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={meta} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
  return screen.getByTestId("pr-cost");
}

describe("PRRow — COST column", () => {
  it("shows the PR cost", () => {
    expect(renderRow(pr({ cost_usd: 0.022 }))).toHaveTextContent("$0.022");
  });

  it("a Stale PR with completed runs still shows its cost", () => {
    expect(renderRow(pr({ status: "stale", cost_usd: 0.022 }))).toHaveTextContent("$0.022");
  });

  it("shows an em dash when the PR has no completed run with cost data", () => {
    const cell = renderRow(pr({ cost_usd: null }));
    expect(cell).toHaveTextContent("—");
    expect(cell).not.toHaveTextContent("$");
  });

  it("shows an em dash when the field is absent", () => {
    expect(renderRow(pr({}))).toHaveTextContent("—");
  });

  it("shows $0.00 when the PR's runs were free", () => {
    const cell = renderRow(pr({ cost_usd: 0 }));
    expect(cell).toHaveTextContent("$0.00");
    expect(cell).not.toHaveTextContent("—");
  });
});

describe("PRRow — FINDINGS column", () => {
  function findingsCell(meta: PrMeta) {
    renderRow(meta);
    return screen.getByTestId("pr-findings");
  }

  it("shows a count per severity that has findings, most severe first", () => {
    const cell = findingsCell(pr({ findings_by_severity: { CRITICAL: 2, WARNING: 1, SUGGESTION: 0 } }));
    expect(screen.getByLabelText("2 Critical")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Warning")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Suggestion/)).not.toBeInTheDocument();
    expect(cell).toHaveTextContent("21");
  });

  it("shows a dash for a PR that was never reviewed", () => {
    expect(findingsCell(pr({ findings_by_severity: null }))).toHaveTextContent("—");
    cleanup();
    expect(findingsCell(pr({}))).toHaveTextContent("—");
  });

  it("shows 0 for a reviewed PR without findings — not a dash", () => {
    const zeros = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
    expect(findingsCell(pr({ findings_by_severity: zeros }))).toHaveTextContent("0");
  });
});

describe("PRRow — review in progress", () => {
  it("shows that a review is running instead of the review status", () => {
    renderRow(pr({ status: "needs_review", active_runs: 1 }));
    expect(screen.getByText("Reviewing…")).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("says how many agents are running when there are several", () => {
    renderRow(pr({ active_runs: 3 }));
    expect(screen.getByText("Reviewing · 3 agents")).toBeInTheDocument();
  });

  it("shows the review status when nothing is running", () => {
    renderRow(pr({ status: "needs_review", active_runs: 0 }));
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    cleanup();
    renderRow(pr({ status: "needs_review" }));
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });
});

describe("PRRow — findings list", () => {
  function finding(id: string, severity: FindingRecord["severity"], title: string): FindingRecord {
    return {
      id,
      severity,
      category: "security",
      title,
      file: "src/a.ts",
      start_line: 12,
      end_line: 12,
      rationale: "Because of this.",
      suggestion: null,
      confidence: 0.9,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "r1",
      accepted_at: null,
      dismissed_at: null,
    };
  }

  function review(o: Partial<ReviewRecord>): ReviewRecord {
    return {
      id: "r1",
      pr_id: "pr-1",
      agent_id: "general",
      run_id: "run-1",
      kind: "review",
      verdict: "comment",
      summary: "",
      score: 50,
      model: "m",
      created_at: "2026-02-01T00:00:00Z",
      findings: [],
      ...o,
    } as ReviewRecord;
  }

  const COUNTS = { CRITICAL: 1, WARNING: 1, SUGGESTION: 0 };

  it("does not load findings until the list is opened", () => {
    renderRow(pr({ findings_by_severity: COUNTS }));
    expect(usePrReviews).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(usePrReviews).toHaveBeenLastCalledWith("pr-1");
    expect(screen.getByRole("dialog", { name: "2 findings" })).toHaveTextContent("Loading findings…");
  });

  it("lists each agent's latest findings, most severe first, skipping superseded reviews", () => {
    usePrReviews.mockReturnValue({
      data: [
        review({ id: "old", created_at: "2026-01-01T00:00:00Z", findings: [finding("x", "SUGGESTION", "Superseded")] }),
        review({ id: "new", findings: [finding("w", "WARNING", "Missing timeout")] }),
        review({ id: "sec", agent_id: "security", findings: [finding("c", "CRITICAL", "SSRF")] }),
      ],
    });
    renderRow(pr({ findings_by_severity: COUNTS }));
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const items = within(screen.getByRole("dialog")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("SSRF"),
      expect.stringContaining("Missing timeout"),
    ]);
  });

  it("opening the list does not open the PR; a finding's title opens its findings tab", () => {
    usePrReviews.mockReturnValue({ data: [review({ findings: [finding("c", "CRITICAL", "SSRF")] })] });
    renderRow(pr({ findings_by_severity: { CRITICAL: 1, WARNING: 0, SUGGESTION: 0 } }));
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "SSRF" }));
    expect(push).toHaveBeenCalledWith("/repos/repo-1/pulls/455?tab=findings");
  });
});
