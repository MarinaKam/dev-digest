import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "", pathname: "/repos/r1/pulls" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { useQueryParams } from "./query-params";

beforeEach(() => {
  nav.replace.mockClear();
  nav.search = "";
});

describe("useQueryParams", () => {
  it("reads a parameter, and null when it is absent", () => {
    nav.search = "tab=diff";
    const { result } = renderHook(() => useQueryParams());
    expect(result.current.get("tab")).toBe("diff");
    expect(result.current.get("trace")).toBeNull();
  });

  it("sets a parameter and keeps the others", () => {
    nav.search = "tab=diff";
    const { result } = renderHook(() => useQueryParams());
    result.current.set("trace", "run-1");
    expect(nav.replace).toHaveBeenCalledWith("/repos/r1/pulls?tab=diff&trace=run-1");
  });

  it("replaces the value of a parameter that is already set", () => {
    nav.search = "tab=diff";
    const { result } = renderHook(() => useQueryParams());
    result.current.set("tab", "findings");
    expect(nav.replace).toHaveBeenCalledWith("/repos/r1/pulls?tab=findings");
  });

  it("removes a parameter for null and leaves a bare path when none remain", () => {
    nav.search = "trace=run-1";
    const { result } = renderHook(() => useQueryParams());
    result.current.set("trace", null);
    expect(nav.replace).toHaveBeenCalledWith("/repos/r1/pulls");
  });
});
