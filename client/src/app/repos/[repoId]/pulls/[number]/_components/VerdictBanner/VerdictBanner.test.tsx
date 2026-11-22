import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { VerdictBanner } from "./VerdictBanner";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("VerdictBanner (smoke)", () => {
  it("shows verdict label + score + finding/blocker counts", () => {
    renderWithIntl(
      <VerdictBanner
        verdict="request_changes"
        summary="Hardcoded secret introduced."
        score={42}
        findingsCount={1}
        blockers={1}
        agentName="Security Reviewer"
      />,
    );
    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/1 findings · 1 blockers/)).toBeInTheDocument();
  });
});

describe("VerdictBanner — run cost line", () => {
  function banner(extra: Partial<React.ComponentProps<typeof VerdictBanner>>) {
    return (
      <VerdictBanner
        verdict="comment"
        summary="Looks fine."
        score={80}
        findingsCount={0}
        blockers={0}
        {...extra}
      />
    );
  }

  it("shows the cost and tokens of the run", () => {
    renderWithIntl(banner({ costUsd: 0.014, tokensIn: 8200, tokensOut: 1300 }));
    expect(screen.getByText("$0.014")).toBeInTheDocument();
    expect(screen.getByText("8.2K→1.3K")).toBeInTheDocument();
  });

  it("shows an em dash when the run has no cost data", () => {
    renderWithIntl(banner({ costUsd: null, tokensIn: 8200, tokensOut: 1300 }));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("shows $0.00 for a free run, not an em dash", () => {
    renderWithIntl(banner({ costUsd: 0 }));
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
