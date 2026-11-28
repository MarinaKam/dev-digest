/* hooks/repos.ts — React Query hooks for repositories:
   GET/POST /repos, POST /repos/:id/refresh, DELETE /repos/:id. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Repo } from "@devdigest/shared";
import { api } from "@/lib/api";
import { pullKeys } from "./pulls";

export const repoKeys = {
  all: ["repos"],
} as const;

export function useRepos() {
  return useQuery({
    queryKey: repoKeys.all,
    queryFn: () => api.get<Repo[]>("/repos"),
  });
}

export function useAddRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.post<Repo>("/repos", { url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: repoKeys.all }),
  });
}

export function useRefreshRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => api.post<Repo>(`/repos/${repoId}/refresh`),
    onSuccess: (_d, repoId) => {
      qc.invalidateQueries({ queryKey: repoKeys.all });
      qc.invalidateQueries({ queryKey: pullKeys.list(repoId) });
    },
  });
}

export function useDeleteRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => api.del<{ deleted: string }>(`/repos/${repoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: repoKeys.all }),
  });
}
