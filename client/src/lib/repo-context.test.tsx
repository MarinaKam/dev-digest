import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Repo } from "@devdigest/shared";

const nav = vi.hoisted(() => ({ pathname: "/conventions" }));
const reposState = vi.hoisted(() => ({ data: undefined as Repo[] | undefined, isSuccess: false }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/hooks/repos", () => ({ useRepos: () => reposState }));

import { RepoProvider, useActiveRepo } from "./repo-context";

const repo = (id: string): Repo => ({
  id,
  workspace_id: "w1",
  owner: "acme",
  name: id,
  full_name: `acme/${id}`,
  default_branch: "main",
  clone_path: null,
  last_polled_at: null,
  created_by: null,
});

function Probe() {
  const { repoId } = useActiveRepo();
  return <span>{`active:${repoId}`}</span>;
}

const renderProbe = () =>
  render(
    <RepoProvider>
      <Probe />
    </RepoProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  reposState.data = [repo("a"), repo("b")];
  reposState.isSuccess = true;
});
afterEach(cleanup);

describe("RepoProvider", () => {
  it("on a page without a repo in the URL uses the stored repo", () => {
    localStorage.setItem("dd-repo", "b");
    nav.pathname = "/conventions";
    renderProbe();
    expect(screen.getByText("active:b")).toBeInTheDocument();
  });

  it("remembers the repo opened by URL, so /conventions shows it next", () => {
    localStorage.setItem("dd-repo", "a");
    nav.pathname = "/repos/b/pulls";
    renderProbe();
    expect(localStorage.getItem("dd-repo")).toBe("b");
  });

  it("falls back to the first repo when the stored one was removed", () => {
    localStorage.setItem("dd-repo", "gone");
    nav.pathname = "/conventions";
    renderProbe();
    expect(screen.getByText("active:a")).toBeInTheDocument();
  });
});
