/* hooks/pulls.ts — React Query hooks for pull requests:
   GET /repos/:id/pulls, GET /pulls/:id. */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { PrDetail, PrMeta } from "@devdigest/shared";
import { api } from "@/lib/api";

export const pullKeys = {
  /** Prefix of every repo's PR list. */
  lists: ["pulls"],
  list: (repoId: string | null | undefined) => ["pulls", repoId],
  detail: (prId: string | number | null | undefined) => ["pull", prId],
} as const;

/** PR list polling while a review is running on any listed PR, and otherwise. */
const PULLS_POLL_ACTIVE_MS = 4_000;
const PULLS_POLL_IDLE_MS = 60_000;

/** How often to re-read the PR list: fast while any PR has a review running,
    so its row leaves "Reviewing…" by itself; slow otherwise. */
export function pullsRefetchInterval(
  pulls: readonly { active_runs?: number | null }[] | undefined,
): number {
  const reviewing = (pulls ?? []).some((pr) => (pr.active_runs ?? 0) > 0);
  return reviewing ? PULLS_POLL_ACTIVE_MS : PULLS_POLL_IDLE_MS;
}

export function usePulls(repoId: string | null | undefined) {
  return useQuery({
    queryKey: pullKeys.list(repoId),
    queryFn: () => api.get<PrMeta[]>(`/repos/${repoId}/pulls`),
    enabled: !!repoId,
    // Auto-refresh PR statuses: re-sync from GitHub every 60s while the page is
    // open (every 4s while a review is running), and whenever the window
    // regains focus.
    refetchInterval: (query) => pullsRefetchInterval(query.state.data),
    refetchOnWindowFocus: true,
  });
}

export function usePullDetail(prId: string | number | null | undefined) {
  return useQuery({
    queryKey: pullKeys.detail(prId),
    queryFn: () => api.get<PrDetail>(`/pulls/${prId}`),
    enabled: prId != null,
  });
}
