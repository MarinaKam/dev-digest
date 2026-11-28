/* hooks/conventions.ts — React Query hooks for the Conventions page (spec 004):
   GET /repos/:id/conventions, POST …/extract, PATCH …/:conventionId, POST …/skill. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ConventionCandidate,
  ConventionList,
  ConventionSampling,
  CreateSkillFromConventions,
  Skill,
  UpdateConvention,
} from "@devdigest/shared";
import { ApiError, api } from "@/lib/api";
import { skillKeys } from "@/lib/hooks/skills";

export const conventionKeys = {
  list: (repoId: string | null | undefined) => ["conventions", repoId],
} as const;

/** The list after one candidate changed: replaced in place (a rejected one stays, marked). */
export function applyConventionChange(list: ConventionList, changed: ConventionCandidate): ConventionList {
  return { ...list, candidates: list.candidates.map((c) => (c.id === changed.id ? changed : c)) };
}

/** How often the list is polled while a run is in flight (started here or in another tab). */
export const RUNNING_POLL_MS = 2_000;

/** Poll only while the server says a run is in flight. */
export function conventionsPollInterval(list: ConventionList | undefined): number | false {
  return list?.running ? RUNNING_POLL_MS : false;
}

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: conventionKeys.list(repoId),
    queryFn: () => api.get<ConventionList>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
    refetchInterval: (query) => conventionsPollInterval(query.state.data),
  });
}

export interface ExtractConventionsInput {
  repoId: string;
  sampling?: ConventionSampling;
}

/** The server refused a run because one is already in flight for the repo. */
export function isRunInFlight(error: unknown): boolean {
  return error instanceof ApiError && error.code === "extraction_running";
}

/** One extraction run (one model call). The answer is the list after the run. */
export function useExtractConventions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ repoId, sampling }: ExtractConventionsInput) =>
      api.post<ConventionList>(`/repos/${repoId}/conventions/extract`, sampling ? { sampling } : {}),
    onSuccess: (data, { repoId }) => qc.setQueryData(conventionKeys.list(repoId), data),
    // A 409 "already running" means another tab started one: reload to show it.
    onError: (_e, { repoId }) => qc.invalidateQueries({ queryKey: conventionKeys.list(repoId) }),
    // The page shows the reason next to the button (or the run in flight).
    meta: { toastErrors: false },
  });
}

export interface UpdateConventionInput {
  repoId: string;
  id: string;
  patch: UpdateConvention;
}

export function useUpdateConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ repoId, id, patch }: UpdateConventionInput) =>
      api.patch<ConventionCandidate>(`/repos/${repoId}/conventions/${id}`, patch),
    onSuccess: (changed, { repoId }) => {
      qc.setQueryData<ConventionList>(conventionKeys.list(repoId), (list) =>
        list ? applyConventionChange(list, changed) : list,
      );
    },
  });
}

export interface CreateConventionsSkillInput {
  repoId: string;
  input: CreateSkillFromConventions;
}

/** Save accepted conventions as a `convention` skill (source `extracted`). */
export function useCreateConventionsSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ repoId, input }: CreateConventionsSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: skillKeys.all }),
  });
}
