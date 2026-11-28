/* hooks/settings.ts — React Query hooks for the settings API:
   GET/PUT /settings, POST /settings/test-connection, GET /settings/secrets-status. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ConnTestProvider,
  ConnTestResult,
  SecretsStatus,
  Settings,
  SettingsUpdate,
} from "@devdigest/shared";
import { api } from "@/lib/api";
import { agentKeys } from "./agents";

export const settingsKeys = {
  all: ["settings"],
  secretsStatus: ["secrets-status"],
} as const;

const SECRETS_STATUS_STALE_MS = 30_000;

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => api.get<Settings>("/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsUpdate) => api.put<Settings>("/settings", patch),
    onSuccess: (data) => qc.setQueryData(settingsKeys.all, data),
  });
}

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnTestProvider | { provider: ConnTestProvider; key?: string }) => {
      const body = typeof input === "string" ? { provider: input } : input;
      return api.post<ConnTestResult>("/settings/test-connection", body);
    },
    // Saving/validating a provider key can change which models resolve — drop the
    // cached (possibly empty) model lists so the agent picker refetches, and
    // refresh the "Configured / Not set" key-status badges.
    onSuccess: (res) => {
      if (res.ok) {
        qc.invalidateQueries({ queryKey: agentKeys.providerModelsAll });
        qc.invalidateQueries({ queryKey: settingsKeys.secretsStatus });
      }
    },
  });
}

/** Which provider keys are configured (booleans only — never the values). */
export function useSecretsStatus() {
  return useQuery({
    queryKey: settingsKeys.secretsStatus,
    queryFn: () => api.get<SecretsStatus>("/settings/secrets-status"),
    staleTime: SECRETS_STATUS_STALE_MS,
  });
}
