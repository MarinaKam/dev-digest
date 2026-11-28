/* hooks/skills.ts — React Query hooks for the Skills page and the agent editor's Skills tab. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AgentSkillLink,
  CreateSkill,
  Skill,
  SkillImportPreview,
  SkillVersion,
  UpdateSkill,
} from "@devdigest/shared";
import { api } from "@/lib/api";

export const skillKeys = {
  all: ["skills"],
  detail: (id: string | null | undefined) => ["skill", id],
  versions: (id: string | null | undefined) => ["skill-versions", id],
  agentLinksAll: ["agent-skills"],
  agentLinks: (agentId: string | null | undefined) => ["agent-skills", agentId],
} as const;

/** How many skills each agent links, from the skills' `used_by`. */
export function skillCountsByAgent(skills: Skill[] | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of skills ?? []) {
    for (const u of s.used_by) counts.set(u.id, (counts.get(u.id) ?? 0) + 1);
  }
  return counts;
}

/** Read a file's bytes as base64, for `POST /skills/import/preview`. */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await readBytes(file));
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/** FileReader, not `Blob.arrayBuffer()`: the second is missing in jsdom. */
function readBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

export function useSkills() {
  return useQuery({
    queryKey: skillKeys.all,
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: skillKeys.detail(id),
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: skillKeys.versions(id),
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkill) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: skillKeys.all }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: UpdateSkill;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: skillKeys.all });
      qc.invalidateQueries({ queryKey: skillKeys.versions(data.id) });
      qc.setQueryData(skillKeys.detail(data.id), data);
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: skillKeys.all });
      qc.removeQueries({ queryKey: skillKeys.detail(id) });
      // Deleting a skill unlinks it from every agent.
      qc.invalidateQueries({ queryKey: skillKeys.agentLinksAll });
    },
  });
}

/** Parse an uploaded file into a draft. Saves nothing. */
export function useImportPreview() {
  return useMutation({
    mutationFn: async (file: File) =>
      api.post<SkillImportPreview>("/skills/import/preview", {
        filename: file.name,
        content_base64: await fileToBase64(file),
      }),
  });
}

/** The agent's linked skills, in order. */
export function useAgentSkillLinks(agentId: string | null | undefined) {
  return useQuery({
    queryKey: skillKeys.agentLinks(agentId),
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

export interface SetAgentSkillsInput {
  agentId: string;
  /** The full ordered set of linked skill ids. */
  skillIds: string[];
}

export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillIds }: SetAgentSkillsInput) =>
      api.post<AgentSkillLink[]>(`/agents/${agentId}/skills`, { skill_ids: skillIds }),
    onSuccess: (data, { agentId }) => {
      qc.setQueryData(skillKeys.agentLinks(agentId), data);
      qc.invalidateQueries({ queryKey: skillKeys.all });
    },
  });
}
