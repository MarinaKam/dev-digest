import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const deleteReview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/reviews", () => ({
  useDeleteReview: () => ({ mutate: deleteReview, isPending: false }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ReviewRunAccordion } from "./ReviewRunAccordion";

beforeEach(() => {
  deleteReview.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function finding(id: string, severity: FindingRecord["severity"]): FindingRecord {
  return {
    id,
    review_id: "rev-1",
    severity,
    category: "bug",
    title: `Finding ${id}`,
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "because",
    suggested_fix: null,
    confidence: 0.9,
    kind: "finding",
    accepted_at: null,
    dismissed_at: null,
  } as unknown as FindingRecord;
}

function review(findings: FindingRecord[], o: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "rev-1",
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: null,
    summary: null,
    score: null,
    created_at: "2026-06-11T18:44:34.000Z",
    findings,
    ...o,
  } as unknown as ReviewRecord;
}

function renderAccordion(props: Partial<React.ComponentProps<typeof ReviewRunAccordion>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <ReviewRunAccordion review={review([finding("f1", "CRITICAL")])} prId="pr-1" {...props} />
    </NextIntlClientProvider>,
  );
}

describe("ReviewRunAccordion", () => {
  it("is a collapsed disclosure button until it is clicked", () => {
    renderAccordion();
    const toggle = screen.getByRole("button", { name: /Security Reviewer/, expanded: false });
    expect(screen.queryByText("Finding f1")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: /Security Reviewer/, expanded: true })).toBeInTheDocument();
    expect(screen.getByText("Finding f1")).toBeInTheDocument();
  });

  it("counts findings and open blockers with the right plural", () => {
    renderAccordion({
      review: review([finding("f1", "CRITICAL"), finding("f2", "CRITICAL"), finding("f3", "WARNING")]),
    });
    expect(screen.getByText("3 findings · 2 blockers")).toBeInTheDocument();
  });

  it("does not use a plural for one finding and leaves blockers out when there are none", () => {
    renderAccordion({ review: review([finding("f1", "WARNING")]) });
    expect(screen.getByText("1 finding")).toBeInTheDocument();
    expect(screen.queryByText(/blocker/)).not.toBeInTheDocument();
  });

  it("deletes the review only after the user confirms, and does not toggle the panel", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderAccordion();
    const del = screen.getByRole("button", { name: "Delete this review run" });

    fireEvent.click(del);
    expect(confirm).toHaveBeenCalledWith('Delete this "Security Reviewer" review run and its findings?');
    expect(deleteReview).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(del);
    expect(deleteReview).toHaveBeenCalledWith("rev-1");
    expect(screen.getByRole("button", { name: /Security Reviewer/, expanded: false })).toBeInTheDocument();
  });

  it("opens and scrolls into view when the timeline targets its run", () => {
    const { rerender } = renderAccordion();
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <ReviewRunAccordion
          review={review([finding("f1", "CRITICAL")])}
          prId="pr-1"
          scrollTarget={{ runId: "run-1", n: 1 }}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Security Reviewer/, expanded: true })).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
