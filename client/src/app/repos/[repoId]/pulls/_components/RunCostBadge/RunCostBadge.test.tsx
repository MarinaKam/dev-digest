import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RunCostBadge } from "./RunCostBadge";

afterEach(cleanup);

describe("RunCostBadge", () => {
  it("compact: shows only the cost", () => {
    render(<RunCostBadge costUsd={0.014} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByText("$0.014")).toBeInTheDocument();
    expect(screen.queryByText(/8\.2K/)).not.toBeInTheDocument();
  });

  it("full: shows the cost and the in→out tokens", () => {
    render(<RunCostBadge variant="full" costUsd={0.014} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByText("$0.014")).toBeInTheDocument();
    expect(screen.getByText("8.2K→1.3K")).toBeInTheDocument();
  });

  it("no cost data: shows an em dash and no tokens, never $0.00", () => {
    render(<RunCostBadge variant="full" costUsd={null} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/8\.2K/)).not.toBeInTheDocument();
  });

  it("a real zero cost is a price, not missing data", () => {
    render(<RunCostBadge costUsd={0} />);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("full without token counts: shows the cost alone", () => {
    render(<RunCostBadge variant="full" costUsd={0.014} tokensIn={null} tokensOut={null} />);
    expect(screen.getByText("$0.014")).toBeInTheDocument();
    expect(screen.queryByText(/K→/)).not.toBeInTheDocument();
  });
});
