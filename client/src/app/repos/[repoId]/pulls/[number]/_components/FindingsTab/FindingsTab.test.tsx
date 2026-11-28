import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReviewRecord, RunSummary } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const data = vi.hoisted(() => ({
  reviews: undefined as unknown,
  runs: undefined as unknown,
  cancel: vi.fn(),
  deleteRun: vi.fn(),
}));

vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: () => ({ data: data.reviews }),
  usePrRuns: () => ({ data: data.runs }),
  useCancelRun: () => ({ mutate: data.cancel, isPending: false }),
  useDeleteRun: () => ({ mutate: data.deleteRun, isPending: false }),
  useDeleteReview: () => ({ mutate: vi.fn(), isPending: false }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
  useRunEvents: () => ({ events: [], running: true }),
}));

import { FindingsTab } from "./FindingsTab";
import { countLethalTrifecta, findingsByRunId } from "./helpers";

const finding = (id: string, kind = "finding") =>
  ({
    id,
    review_id: "rev-1",
    severity: "WARNING",
    category: "bug",
    title: `Finding ${id}`,
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "because",
    suggestion: null,
    confidence: 0.9,
    kind,
    accepted_at: null,
    dismissed_at: null,
  }) as unknown as ReviewRecord["findings"][number];

const review = (o: Partial<ReviewRecord> = {}) =>
  ({
    id: "rev-1",
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: null,
    summary: null,
    score: null,
    created_at: "2026-06-11T18:44:34.000Z",
    findings: [finding("f1")],
    ...o,
  }) as unknown as ReviewRecord;

const run = (o: Partial<RunSummary> = {}) =>
  ({
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "m",
    status: "done",
    error: null,
    duration_ms: 1,
    tokens_in: 1,
    tokens_out: 1,
    cost_usd: null,
    findings_count: 1,
    grounding: "",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  }) as unknown as RunSummary;

const onOpenTrace = vi.fn();

function renderTab(liveRunIds: string[] = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FindingsTab
        prId="pr-1"
        liveRunIds={liveRunIds}
        commits={[]}
        onOpenTrace={onOpenTrace}
        onRunDone={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  data.reviews = undefined;
  data.runs = undefined;
  data.cancel.mockClear();
  data.deleteRun.mockClear();
  onOpenTrace.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FindingsTab", () => {
  it("invites to run a review when there are no reviews and nothing is running", () => {
    renderTab();
    expect(screen.getByText("No findings yet")).toBeInTheDocument();
    expect(screen.queryByText("Live review")).not.toBeInTheDocument();
    expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
  });

  it("shows the live section instead of the empty state while a run is in flight", () => {
    renderTab(["run-1", "run-2"]);
    expect(screen.getByText("Live review")).toBeInTheDocument();
    expect(screen.getByText("Review in progress…")).toBeInTheDocument();
    expect(screen.queryByText("No findings yet")).not.toBeInTheDocument();
  });

  it("cancels every in-flight run and opens the trace of the first", () => {
    renderTab(["run-1", "run-2"]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(data.cancel.mock.calls.map((call) => call[0])).toEqual(["run-1", "run-2"]);

    fireEvent.click(screen.getByRole("button", { name: "Open run trace" }));
    expect(onOpenTrace).toHaveBeenCalledWith("run-1");
  });

  it("lists the timeline and one accordion per review, the newest one open", () => {
    data.reviews = [review(), review({ id: "rev-2", run_id: "run-2", agent_name: "Style Reviewer" })];
    data.runs = [run(), run({ run_id: "run-2", agent_name: "Style Reviewer" })];
    renderTab();

    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Security Reviewer.*finding/, expanded: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Style Reviewer.*finding/, expanded: false })).toBeInTheDocument();
  });

  it("deletes a run only after the user confirms", () => {
    data.reviews = [review()];
    data.runs = [run()];
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Delete run" }));
    expect(confirm).toHaveBeenCalledWith("Delete this run from history? (its logs are removed too)");
    expect(data.deleteRun).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete run" }));
    expect(data.deleteRun).toHaveBeenCalledWith("run-1");
  });

  it("opens the review of the run whose agent name is clicked in the timeline", () => {
    data.reviews = [review(), review({ id: "rev-2", run_id: "run-2", agent_name: "Style Reviewer" })];
    data.runs = [run(), run({ run_id: "run-2", agent_name: "Style Reviewer" })];
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Style Reviewer" }));

    expect(screen.getByRole("button", { name: /^Style Reviewer.*finding/, expanded: true })).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("flags a lethal trifecta with its count", () => {
    data.reviews = [review({ findings: [finding("f1", "lethal_trifecta"), finding("f2")] })];
    renderTab();
    expect(screen.getByText("Lethal Trifecta detected")).toBeInTheDocument();
    expect(screen.getByText("1 finding(s)")).toBeInTheDocument();
  });
});

describe("FindingsTab helpers", () => {
  it("keys findings by run id and skips a review without a run", () => {
    const withRun = review();
    const withoutRun = review({ id: "rev-2", run_id: null });
    expect(findingsByRunId([withRun, withoutRun])).toEqual({ "run-1": withRun.findings });
  });

  it("counts lethal-trifecta findings across reviews", () => {
    const reviews = [
      review({ findings: [finding("f1", "lethal_trifecta")] }),
      review({ id: "rev-2", findings: [finding("f2"), finding("f3", "lethal_trifecta")] }),
    ];
    expect(countLethalTrifecta(reviews)).toBe(2);
    expect(countLethalTrifecta([])).toBe(0);
  });
});
