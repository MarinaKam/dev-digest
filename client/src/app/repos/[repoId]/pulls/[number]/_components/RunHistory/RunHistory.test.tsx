/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, RunSummary } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — run cost", () => {
  it("a done run with cost data shows the cost and the in→out tokens", () => {
    renderRuns([run({ status: "done", cost_usd: 0.0013, tokens_in: 9119, tokens_out: 1240 })]);
    expect(screen.getByText("$0.0013")).toBeInTheDocument();
    expect(screen.getByText("9.1K→1.2K")).toBeInTheDocument();
  });

  it("a done run on a free model shows $0.00, not an em dash", () => {
    renderRuns([run({ status: "done", cost_usd: 0 })]);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("a done run without cost data shows an em dash", () => {
    renderRuns([run({ status: "done", cost_usd: null })]);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it.each(["running", "failed", "cancelled"])("a %s run never shows a price", (status) => {
    renderRuns([run({ status, cost_usd: 0.5, error: status === "failed" ? "boom" : null })]);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});

describe("RunHistory — findings per severity", () => {
  function finding(id: string, severity: FindingRecord["severity"], title: string): FindingRecord {
    return {
      id,
      severity,
      category: "security",
      title,
      file: "src/a.ts",
      start_line: 19,
      end_line: 55,
      rationale: "Because of this.",
      suggestion: null,
      confidence: 0.95,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "r1",
      accepted_at: null,
      dismissed_at: null,
    };
  }

  const FOUND = [
    finding("w1", "WARNING", "Date range is inclusive"),
    finding("c1", "CRITICAL", "Endpoints are unauthenticated"),
    finding("c2", "CRITICAL", "Secret in config"),
  ];

  function renderHistory(findingsByRun?: Record<string, FindingRecord[]>) {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <RunHistory
          runs={[run({ findings_count: 3, blockers: 2 })]}
          onOpenTrace={() => {}}
          findingsByRun={findingsByRun}
        />
      </NextIntlClientProvider>,
    );
  }

  it("shows a count per severity for a settled run and keeps the blockers", () => {
    renderHistory({ "run-1": FOUND });
    expect(screen.getByLabelText("2 Critical")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Warning")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Suggestion/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 blockers/)).toBeInTheDocument();
    expect(screen.queryByText(/3 finding\(s\)/)).not.toBeInTheDocument();
  });

  it("previews the run's findings on hover, most severe first, and hides them on leave", () => {
    renderHistory({ "run-1": FOUND });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { expanded: false });
    fireEvent.mouseEnter(trigger.parentElement!);
    const dialog = screen.getByRole("dialog", { name: "3 findings in this run" });
    expect(within(dialog).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Endpoints are unauthenticated"),
      expect.stringContaining("Secret in config"),
      expect.stringContaining("Date range is inclusive"),
    ]);
    expect(dialog).toHaveTextContent("src/a.ts:19-55");
    expect(dialog).toHaveTextContent("95% conf");
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a click pins the list open; Escape, a second click or a click outside closes it", () => {
    renderHistory({ "run-1": FOUND });
    const trigger = screen.getByRole("button", { expanded: false });
    fireEvent.click(trigger);
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("scrolling the page closes a pinned list; scrolling inside the list does not", () => {
    renderHistory({ "run-1": FOUND });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.scroll(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.scroll(document);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("scrolling the page also closes a list that is only hovered", () => {
    renderHistory({ "run-1": FOUND });
    fireEvent.mouseEnter(screen.getByRole("button", { expanded: false }).parentElement!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.scroll(document);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a finding's file links to GitHub and its title jumps to the run's findings", () => {
    const onGoToReview = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <RunHistory
          runs={[run({ findings_count: 3, blockers: 2 })]}
          onOpenTrace={() => {}}
          onGoToReview={onGoToReview}
          findingsByRun={{ "run-1": FOUND }}
          repoFullName="acme/app"
          headSha="abc123"
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const dialog = screen.getByRole("dialog");
    const link = within(dialog).getAllByRole("link")[0]!;
    expect(link).toHaveAttribute("href", expect.stringContaining("github.com/acme/app/blob/abc123/src/a.ts"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Secret in config" }));
    expect(onGoToReview).toHaveBeenCalledWith("run-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("falls back to the plain finding count when the run's findings are not loaded", () => {
    renderHistory();
    expect(screen.getByText(/3 finding\(s\)/)).toBeInTheDocument();
    cleanup();
    renderHistory({ "another-run": FOUND });
    expect(screen.getByText(/3 finding\(s\)/)).toBeInTheDocument();
    cleanup();
    renderHistory({ "run-1": [] });
    expect(screen.getByText(/3 finding\(s\)/)).toBeInTheDocument();
  });
});
