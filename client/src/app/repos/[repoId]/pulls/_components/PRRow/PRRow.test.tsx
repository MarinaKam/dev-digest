import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import messages from "../../../../../../../messages/en/prReview.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PRRow } from "./PRRow";

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
