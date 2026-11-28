import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../messages/en/home.json";
import { ApiError } from "@/lib/api";

const push = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const refetch = vi.hoisted(() => vi.fn());
const useRepos = vi.hoisted(() => vi.fn());
const active = vi.hoisted(() => ({ activeRepo: null as { id: string; full_name: string } | null, ready: true }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("@/lib/hooks/repos", () => ({ useRepos }));
vi.mock("@/lib/repo-context", () => ({ useActiveRepo: () => active }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { HomeView } from "./HomeView";

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  refetch.mockClear();
  useRepos.mockReset();
  active.activeRepo = null;
  active.ready = true;
});
afterEach(cleanup);

function renderView() {
  render(
    <NextIntlClientProvider locale="en" messages={{ home: messages }}>
      <HomeView />
    </NextIntlClientProvider>,
  );
}

describe("HomeView", () => {
  it("shows the server's message with a retry when the repositories fail to load", () => {
    useRepos.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError("Engine unreachable", 503),
      refetch,
    });
    renderView();

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load repositories");
    expect(screen.getByRole("alert")).toHaveTextContent("Engine unreachable");
    expect(screen.queryByText("No repositories yet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("offers to add a repository when the list is empty", () => {
    useRepos.mockReturnValue({ data: [], isLoading: false, error: null, refetch });
    renderView();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("No repositories yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    expect(push).toHaveBeenCalledWith("/onboarding");
  });

  it("sends the user to the active repository's pull requests", () => {
    useRepos.mockReturnValue({ data: [{ id: "repo-1" }, { id: "repo-2" }], isLoading: false, error: null, refetch });
    active.activeRepo = { id: "repo-2", full_name: "acme/web" };
    renderView();

    expect(replace).toHaveBeenCalledWith("/repos/repo-2/pulls");
  });

  it("does not redirect before the stored repo choice was read", () => {
    useRepos.mockReturnValue({ data: [{ id: "repo-1" }], isLoading: false, error: null, refetch });
    active.activeRepo = { id: "repo-1", full_name: "acme/api" };
    active.ready = false;
    renderView();

    expect(replace).not.toHaveBeenCalled();
  });
});
