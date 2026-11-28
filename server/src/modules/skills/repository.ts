import { and, asc, desc, eq } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { INITIAL_SKILL_VERSION } from './constants.js';
import type {
  InsertSkill,
  SkillPatch,
  SkillRecord,
  SkillUserRecord,
  SkillVersionRecord,
} from './types.js';

/**
 * Skills data-access. Owns `skills` and `skill_versions`. Reads `agent_skills`
 * and `agents` only to say which agents use a skill (the link table is written
 * by the agents module). Workspace-scoped throughout.
 */
export class SkillsRepository {
  constructor(private db: DbExecutor) {}

  async list(workspaceId: string): Promise<SkillRecord[]> {
    const rows = await this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
    return rows.map(toRecord);
  }

  async getById(workspaceId: string, id: string): Promise<SkillRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row ? toRecord(row) : undefined;
  }

  async findByName(workspaceId: string, name: string): Promise<SkillRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, name)));
    return row ? toRecord(row) : undefined;
  }

  /** Insert a skill and its version 1 (with `note`) together. */
  create(workspaceId: string, input: InsertSkill, note: string): Promise<SkillRecord> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.skills)
        .values({ workspaceId, ...input, version: INITIAL_SKILL_VERSION })
        .returning();
      if (!row) throw new Error('skill insert returned no row');
      await tx
        .insert(t.skillVersions)
        .values({ skillId: row.id, version: INITIAL_SKILL_VERSION, body: row.body, note });
      return toRecord(row);
    });
  }

  /**
   * Apply `patch`. With `newVersion`, the version is raised by one and the new
   * body is snapshotted with `note`, in the same transaction as the update.
   */
  update(
    workspaceId: string,
    id: string,
    patch: SkillPatch,
    newVersion: boolean,
    note: string | null = null,
  ): Promise<SkillRecord | undefined> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(t.skills)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .for('update');
      if (!current) return undefined;
      const version = newVersion ? current.version + 1 : current.version;
      const [row] = await tx
        .update(t.skills)
        .set({ ...patch, version })
        .where(eq(t.skills.id, id))
        .returning();
      if (!row) return undefined;
      if (newVersion) {
        await tx.insert(t.skillVersions).values({ skillId: id, version, body: row.body, note });
      }
      return toRecord(row);
    });
  }

  /** Delete a skill; its versions and agent links go with it (cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  async versions(skillId: string): Promise<SkillVersionRecord[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  /** Agents linking each skill of the workspace, in one grouped read. */
  async usedBy(workspaceId: string): Promise<Map<string, SkillUserRecord[]>> {
    const rows = await this.db
      .select({ skillId: t.agentSkills.skillId, id: t.agents.id, name: t.agents.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(eq(t.agents.workspaceId, workspaceId))
      .orderBy(asc(t.agents.name));
    const map = new Map<string, SkillUserRecord[]>();
    for (const r of rows) {
      map.set(r.skillId, [...(map.get(r.skillId) ?? []), { id: r.id, name: r.name }]);
    }
    return map;
  }
}

function toRecord(row: typeof t.skills.$inferSelect): SkillRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidenceFiles: row.evidenceFiles ?? null,
    createdAt: row.createdAt,
  };
}
