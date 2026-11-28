import type { Skill, SkillVersion } from '@devdigest/shared';
import type { SkillPatch, SkillRecord, SkillUserRecord, SkillVersionRecord } from './types.js';

/** Map a stored skill and the agents linking it to the public `Skill` DTO. */
export function toSkillDto(row: SkillRecord, usedBy: SkillUserRecord[] = []): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles,
    used_by: usedBy.map((u) => ({ id: u.id, name: u.name })),
    created_at: row.createdAt.toISOString(),
  };
}

export function toSkillVersionDto(row: SkillVersionRecord): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    note: row.note,
    created_at: row.createdAt.toISOString(),
  };
}

/** A save makes a new version only when it changes the body (rule 5). */
export function bodyChanged(current: SkillRecord, patch: SkillPatch): boolean {
  return patch.body !== undefined && patch.body !== current.body;
}
