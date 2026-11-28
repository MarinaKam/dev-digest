import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/runs.json"; // apps/web/messages/en/runs.json

// Mock the trace hooks so the drawer renders without a query client / SSE.
const TRACE: RunTrace = {
  config: { agent: "Security", version: "1", provider: "openai", model: "gpt-4.1", pr: 482, source: "local" },
  stats: { duration_ms: 8200, tokens_in: 12000, tokens_out: 1500, cost_usd: 0.0123, findings: 2, grounding: "2/2 passed" },
  prompt_assembly: { system: "You are a reviewer.", skills: "### skill", memory: null, specs: null, user: "Review PR #482" },
  tool_calls: [{ tool: "review_file", args: "src/config.ts", meta: "single-pass", ms: 1200 }],
  raw_output: '{"verdict":"request_changes"}',
  memory_pulled: [{ pr: 471, text: "rate-limit public endpoints" }],
  specs_read: [],
  log: [
    { t: "00.10", kind: "info", msg: "Starting review with agent Security" },
    { t: "00.90", kind: "result", msg: "Citation grounding: 2/2 passed" },
  ],
};

// Overridable per test: what the trace endpoint returns.
let traceData: RunTrace = TRACE;
vi.mock("@/lib/hooks/trace", () => ({
  useRunTrace: () => ({ data: traceData, isLoading: false }),
}));
vi.mock("@/lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running: false }),
}));

import { RunTraceDrawer } from "./RunTraceDrawer";

afterEach(() => {
  cleanup();
  traceData = TRACE;
});

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <div data-theme="dark">{ui}</div>
    </NextIntlClientProvider>,
  );
}

describe("A5 Run Trace drawer (smoke)", () => {
  it("renders the trace tabs and stats", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();
    expect(screen.getByText("2/2 passed")).toBeInTheDocument();
    expect(screen.getByText("Tool calls")).toBeInTheDocument();
  });

  it("switches to the live log tab", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    fireEvent.click(screen.getByText("log"));
    // LiveLogStream renders its filter input
    expect(screen.getByPlaceholderText("Filter log…")).toBeInTheDocument();
  });
});

describe("Run Trace drawer — COST stat", () => {
  it("shows the COST tile between TOKENS and FINDINGS with the run cost", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    const tile = screen.getByText("COST").parentElement!;
    expect(tile).toHaveTextContent("$0.0123");
    expect(tile.previousElementSibling).toHaveTextContent("TOKENS");
    expect(tile.nextElementSibling).toHaveTextContent("FINDINGS");
  });

  it("shows an em dash when the trace has no cost (failed, running or pre-feature run)", () => {
    traceData = { ...TRACE, stats: { ...TRACE.stats, cost_usd: null } };
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByText("COST").parentElement).toHaveTextContent("—");
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });

  it("shows $0.00 for a free run, not an em dash", () => {
    traceData = { ...TRACE, stats: { ...TRACE.stats, cost_usd: 0 } };
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });
});

describe("Run Trace drawer — skills block", () => {
  const open = () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Prompt assembly"));
  };

  it("labels the skills block with tokens and name@version", () => {
    traceData = {
      ...TRACE,
      prompt_assembly: {
        ...TRACE.prompt_assembly,
        skills_tokens: 1200,
        skills_used: [
          { name: "api-contract", version: 1 },
          { name: "edge-case-coverage", version: 3 },
        ],
      },
    };
    open();
    expect(screen.getByText("Skills · 1200 tokens · api-contract@v1, edge-case-coverage@v3")).toBeInTheDocument();
  });

  it("shows no skills block when the trace has no skills", () => {
    traceData = { ...TRACE, prompt_assembly: { ...TRACE.prompt_assembly, skills: null } };
    open();
    expect(screen.queryByText(/^Skills/)).not.toBeInTheDocument();
  });
});
