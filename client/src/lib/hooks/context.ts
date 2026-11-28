/* hooks/context.ts — React Query hooks for the project context (A3 contract;
   safe to call once the API exposes it): GET /repos/:id/context,
   POST /repos/:id/context/reindex. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { IndexStatus, SpecFile } from "@devdigest/shared";
import { api } from "@/lib/api";

export const contextKeys = {
  files: (repoId: string | null | undefined) => ["context", repoId],
} as const;

export function useContextFiles(repoId: string | null | undefined) {
  return useQuery({
    queryKey: contextKeys.files(repoId),
    queryFn: () => api.get<SpecFile[]>(`/repos/${repoId}/context`),
    enabled: !!repoId,
  });
}

export function useReindexContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => api.post<IndexStatus>(`/repos/${repoId}/context/reindex`),
    onSuccess: (_d, repoId) => qc.invalidateQueries({ queryKey: contextKeys.files(repoId) }),
  });
}
