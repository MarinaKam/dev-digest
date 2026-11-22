import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const mutate = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate, isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

function finding(
  id: string,
  severity: FindingRecord["severity"],
  title: string,
  confidence = 0.9,
): FindingRecord {
  return { ...FINDINGS[0]!, id, severity, title, confidence };
}

const MIXED: FindingRecord[] = [
  finding("c1", "CRITICAL", "Missing auth check"),
  finding("w1", "WARNING", "No rate limit"),
  finding("w2", "WARNING", "Leaky error message", 0.4),
  finding("s1", "SUGGESTION", "Extract a constant"),
];

const TITLES = MIXED.map((f) => f.title);

function shownTitles() {
  return TITLES.filter((title) => screen.queryByText(title) !== null);
}

describe("FindingsPanel severity counters", () => {
  it("shows the counters above the list, matching the findings of the run", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    expect(screen.getByRole("button", { name: "1 CRITICAL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 WARNING" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 SUGGESTION" })).toBeInTheDocument();
    expect(shownTitles()).toEqual(TITLES);
  });

  it("clicking a level leaves only its findings in the list", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "2 WARNING" }));
    expect(shownTitles()).toEqual(["No rate limit", "Leaky error message"]);
  });

  it("clicking the active level again restores the full list", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "2 WARNING" }));
    fireEvent.click(screen.getByRole("button", { name: "2 WARNING" }));
    expect(shownTitles()).toEqual(TITLES);
    expect(screen.getByRole("button", { name: "2 WARNING" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking another level moves the filter to it", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "2 WARNING" }));
    fireEvent.click(screen.getByRole("button", { name: "1 CRITICAL" }));
    expect(shownTitles()).toEqual(["Missing auth check"]);
    expect(screen.getByRole("button", { name: "1 CRITICAL" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "2 WARNING" })).toHaveAttribute("aria-pressed", "false");
  });

  it("combines with hide-low-confidence and keeps the counts of the whole run", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "2 WARNING" }));
    fireEvent.click(screen.getByRole("switch"));
    expect(shownTitles()).toEqual(["No rate limit"]);
    expect(screen.getByRole("button", { name: "2 WARNING" })).toBeInTheDocument();
  });

  it("shows the empty state when the level has only low-confidence findings hidden", () => {
    const run = [finding("c1", "CRITICAL", "Missing auth check"), finding("w2", "WARNING", "Leaky error message", 0.4)];
    renderWithIntl(<FindingsPanel findings={run} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "1 WARNING" }));
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });

  it("a level without findings shows 0 and does not filter", () => {
    const run = MIXED.filter((f) => f.severity !== "CRITICAL");
    renderWithIntl(<FindingsPanel findings={run} prId="pr1" />);
    const critical = screen.getByRole("button", { name: "0 CRITICAL" });
    expect(critical).toBeDisabled();
    fireEvent.click(critical);
    expect(shownTitles()).toEqual(run.map((f) => f.title));
  });

  it("falls back to the full list when the active level loses all its findings", () => {
    const { rerender } = renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "1 CRITICAL" }));
    const withoutCritical = MIXED.filter((f) => f.severity !== "CRITICAL");
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={withoutCritical} prId="pr1" />
      </NextIntlClientProvider>,
    );
    expect(shownTitles()).toEqual(withoutCritical.map((f) => f.title));
  });

  it("does not bring the filter back when the level gets findings again", () => {
    const { rerender } = renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "1 CRITICAL" }));
    const panel = (findings: FindingRecord[]) => (
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={findings} prId="pr1" />
      </NextIntlClientProvider>
    );
    rerender(panel(MIXED.filter((f) => f.severity !== "CRITICAL")));
    rerender(panel(MIXED));
    expect(shownTitles()).toEqual(TITLES);
    expect(screen.getByRole("button", { name: "1 CRITICAL" })).toHaveAttribute("aria-pressed", "false");
  });

  it("changing the filter moves keyboard focus to the first card of the new list", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.click(screen.getByRole("button", { name: "1 SUGGESTION" }));
    fireEvent.keyDown(window, { key: "a" });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ findingId: "s1", action: "accept", prId: "pr1" });
  });

  it("shows no counters for a run without findings", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.queryByRole("button", { name: /CRITICAL/ })).not.toBeInTheDocument();
  });

  it("keeps the filter of one run separate from another run", () => {
    renderWithIntl(
      <>
        <div data-testid="run-a">
          <FindingsPanel findings={MIXED} prId="pr1" />
        </div>
        <div data-testid="run-b">
          <FindingsPanel findings={[finding("b1", "SUGGESTION", "Rename a variable")]} prId="pr1" />
        </div>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "1 CRITICAL" }));
    expect(screen.getByText("Rename a variable")).toBeInTheDocument();
    expect(screen.queryByText("No rate limit")).not.toBeInTheDocument();
  });
});
