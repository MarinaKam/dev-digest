import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { ConventionList } from "@devdigest/shared";
import { ERROR_RULE, ROUTE_RULE, renderWithIntl } from "../test-utils";

const extractMutate = vi.hoisted(() => vi.fn());
const updateMutate = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  data: undefined as ConventionList | undefined,
  isLoading: false,
  error: null as Error | null,
  extractError: null as Error | null,
  extracting: false,
}));

const repoState = vi.hoisted(() => ({
  activeRepo: { id: "r1", name: "payments-api", full_name: "acme/payments-api", default_branch: "main" } as
    | { id: string; name: string; full_name: string; default_branch: string }
    | null,
  reposLoaded: true,
}));
vi.mock("@/lib/repo-context", () => ({ useActiveRepo: () => repoState }));
vi.mock("@/lib/hooks/conventions", () => ({
  isRunInFlight: (e: unknown) => (e as { code?: string } | null)?.code === "extraction_running",
  useConventions: () => ({ data: state.data, isLoading: state.isLoading, error: state.error, refetch: vi.fn() }),
  useExtractConventions: () => ({ mutate: extractMutate, isPending: state.extracting, error: state.extractError }),
  useUpdateConvention: () => ({ mutate: updateMutate, isPending: false, variables: undefined }),
  useCreateConventionsSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ConventionsView } from "./ConventionsView";

const SCAN = {
  at: new Date().toISOString(),
  sampling: "spread" as const,
  files_sampled: 14,
  proposed: 6,
  kept: 2,
  added: 2,
  model: "openrouter/deepseek/deepseek-v4-flash",
  cost_usd: 0.0004,
};

const RUNNING = {
  started_at: new Date(Date.now() - 20_000).toISOString(),
  sampling: "spread" as const,
  files_sampled: 23,
  model: "openrouter/deepseek/deepseek-v4-flash",
};

afterEach(() => {
  cleanup();
  extractMutate.mockClear();
  updateMutate.mockClear();
  Object.assign(state, { data: undefined, isLoading: false, error: null, extractError: null, extracting: false });
  repoState.activeRepo = { id: "r1", name: "payments-api", full_name: "acme/payments-api", default_branch: "main" };
});

describe("ConventionsView", () => {
  it("before the first scan shows the empty state, and Run extraction starts one run", () => {
    state.data = { candidates: [], last_scan: null, running: null };
    renderWithIntl(<ConventionsView />);
    expect(screen.getByText("No conventions extracted yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run extraction" }));
    expect(extractMutate).toHaveBeenCalledWith({ repoId: "r1" });
  });

  it("shows a load error with a retry", () => {
    state.error = new Error("boom");
    renderWithIntl(<ConventionsView />);
    expect(screen.getByText("Could not load conventions.")).toBeInTheDocument();
  });

  it("shows why an extraction failed", () => {
    state.data = { candidates: [], last_scan: null, running: null };
    state.extractError = new Error("The repository is still being cloned. Try again in a minute.");
    renderWithIntl(<ConventionsView />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Extraction failed: The repository is still being cloned. Try again in a minute.",
    );
  });

  it("lists the candidates with the repo, the last scan and the accepted count", () => {
    state.data = {
      candidates: [{ ...ROUTE_RULE, status: "accepted", accepted: true }, ERROR_RULE],
      last_scan: SCAN,
      running: null,
    };
    renderWithIntl(<ConventionsView />);
    expect(screen.getByRole("heading", { name: "Conventions in payments-api" })).toBeInTheDocument();
    expect(screen.getByText(/Detected from 14 sample files/)).toBeInTheDocument();
    expect(screen.getByText("The model proposed 6; 2 had evidence in the code, 2 new.")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 accepted")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open src/routes/users.ts:5-6 on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/acme/payments-api/blob/main/src/routes/users.ts#L5-L6",
    );
  });

  it("Accept and Reject send the status of that candidate", () => {
    state.data = { candidates: [ROUTE_RULE], last_scan: SCAN, running: null };
    renderWithIntl(<ConventionsView />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(updateMutate.mock.calls.map((c) => c[0])).toEqual([
      { repoId: "r1", id: "c1", patch: { status: "accepted" } },
      { repoId: "r1", id: "c1", patch: { status: "rejected" } },
    ]);
  });

  it("shows a rejected candidate marked, and leaves it out of the count and Accept all", () => {
    state.data = {
      candidates: [ROUTE_RULE, { ...ERROR_RULE, status: "rejected" }],
      last_scan: SCAN,
      running: null,
    };
    renderWithIntl(<ConventionsView />);
    expect(screen.getByRole("button", { name: "Rejected" })).toBeInTheDocument();
    expect(screen.getByText("0 of 1 accepted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(updateMutate.mock.calls.map((c) => c[0].id)).toEqual(["c1"]);
  });

  it("Accept all accepts every pending candidate", () => {
    state.data = { candidates: [ROUTE_RULE, ERROR_RULE], last_scan: SCAN, running: null };
    renderWithIntl(<ConventionsView />);
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(updateMutate.mock.calls.map((c) => c[0].id)).toEqual(["c1", "c2"]);
  });

  it("Create skill waits for an accepted candidate and opens the modal with the accepted ones", () => {
    state.data = { candidates: [ROUTE_RULE], last_scan: SCAN, running: null };
    const { unmount } = renderWithIntl(<ConventionsView />);
    expect(screen.getByRole("button", { name: "Create skill" })).toBeDisabled();
    unmount();

    state.data = { candidates: [{ ...ROUTE_RULE, status: "accepted", accepted: true }, ERROR_RULE], last_scan: SCAN, running: null };
    renderWithIntl(<ConventionsView />);
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(screen.getByText(/Merged from 1 accepted convention in payments-api/)).toBeInTheDocument();
  });

  it("Re-scan runs the extraction again", () => {
    state.data = { candidates: [ROUTE_RULE], last_scan: SCAN, running: null };
    renderWithIntl(<ConventionsView />);
    fireEvent.click(screen.getByRole("button", { name: "Re-scan" }));
    expect(extractMutate).toHaveBeenCalledWith({ repoId: "r1" });
  });

  it("never says a scan happened in the future when the server clock is ahead", () => {
    state.data = { candidates: [ROUTE_RULE], last_scan: { ...SCAN, at: new Date(Date.now() + 60_000).toISOString() }, running: null };
    renderWithIntl(<ConventionsView />);
    expect(screen.getByText(/last scan now/)).toBeInTheDocument();
  });

  it("says when the last scan kept nothing", () => {
    state.data = { candidates: [], last_scan: { ...SCAN, kept: 0, added: 0 }, running: null };
    renderWithIntl(<ConventionsView />);
    expect(screen.getByText(/The last scan found no convention with evidence in the code/)).toBeInTheDocument();
  });

  it("without a repository asks to add one and runs nothing", () => {
    repoState.activeRepo = null;
    renderWithIntl(<ConventionsView />);
    expect(screen.getByText("No repository selected")).toBeInTheDocument();
    expect(extractMutate).not.toHaveBeenCalled();
  });

  it("a run started in another tab shows as running and blocks Re-scan with a hint", () => {
    state.data = { candidates: [ROUTE_RULE], last_scan: SCAN, running: RUNNING };
    renderWithIntl(<ConventionsView />);
    const status = screen.getByText("Extraction running").closest("[role=status]");
    expect(status).not.toBeNull();
    expect(status).toHaveTextContent("started 20 seconds ago");
    expect(status).toHaveTextContent("23 files");
    expect(status).toHaveTextContent("openrouter/deepseek/deepseek-v4-flash");
    const button = screen.getByRole("button", { name: "Scanning…" });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute(
      "title",
      "An extraction is running for this repository. The page updates when it finishes.",
    );
  });

  it("an 'already running' refusal is shown as the run in flight, not as a failure", () => {
    state.data = { candidates: [ROUTE_RULE], last_scan: SCAN, running: RUNNING };
    state.extractError = Object.assign(new Error("An extraction is already running for this repository."), {
      code: "extraction_running",
    });
    renderWithIntl(<ConventionsView />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Extraction running")).toBeInTheDocument();
  });
});
