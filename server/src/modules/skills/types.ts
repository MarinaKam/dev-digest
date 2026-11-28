import type { SkillSource, SkillType } from '@devdigest/shared';

/**
 * Skill domain values. The repository returns these; the service and the pure
 * helpers take them. None of them is inferred from a table.
 */

export interface SkillRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled: boolean;
  version: number;
  evidenceFiles: string[] | null;
  createdAt: Date;
}

/** An immutable snapshot of a skill's body at one version. */
export interface SkillVersionRecord {
  skillId: string;
  version: number;
  body: string;
  note: string | null;
  createdAt: Date;
}

/** An agent that links a skill. */
export interface SkillUserRecord {
  id: string;
  name: string;
}

export interface InsertSkill {
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled: boolean;
  /** Files the skill's rules were found in (extracted skills only). */
  evidenceFiles?: string[] | null;
}

export interface SkillPatch {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/** A skill made from accepted conventions; saved as `convention` / `extracted`. */
export interface ExtractedSkillInput {
  name: string;
  description: string;
  body: string;
  enabled: boolean;
  evidenceFiles: string[];
  /** Note of version 1, e.g. "Extracted from acme/api". */
  note: string;
}
