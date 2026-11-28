import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { normaliseRule } from './helpers.js';
import type {
  ConventionPatch,
  ConventionRecord,
  ConventionScanRecord,
  GroundedConvention,
  ScanFacts,
} from './types.js';

/**
 * Conventions data-access. Owns `conventions`. Workspace- and repo-scoped
 * throughout: every query filters by both.
 */
export class ConventionsRepository {
  constructor(private db: DbExecutor) {}

  /** All candidates of a repo: accepted, then pending, then rejected; by confidence within each. */
  async listAll(workspaceId: string, repoId: string): Promise<ConventionRecord[]> {
    const rows = await this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)))
      .orderBy(
        sql`case ${t.conventions.status} when 'accepted' then 0 when 'pending' then 1 else 2 end`,
        desc(t.conventions.confidence),
        t.conventions.createdAt,
      );
    return rows.map(toRecord);
  }

  /** The repo's newest run, or `undefined` when it was never scanned. */
  async lastScan(workspaceId: string, repoId: string): Promise<ConventionScanRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventionScans)
      .where(and(eq(t.conventionScans.workspaceId, workspaceId), eq(t.conventionScans.repoId, repoId)))
      .orderBy(desc(t.conventionScans.createdAt))
      .limit(1);
    return row
      ? {
          sampling: row.sampling,
          filesSampled: row.filesSampled,
          proposed: row.proposed,
          kept: row.kept,
          added: row.added,
          model: row.model,
          costUsd: row.costUsd,
          createdAt: row.createdAt,
        }
      : undefined;
  }

  async getById(workspaceId: string, repoId: string, id: string): Promise<ConventionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.id, id),
        ),
      );
    return row ? toRecord(row) : undefined;
  }

  /** Rows of this repo among `ids`, any status. */
  async getMany(workspaceId: string, repoId: string, ids: string[]): Promise<ConventionRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          inArray(t.conventions.id, ids),
        ),
      );
    return rows.map(toRecord);
  }

  /** Change the rule text and/or the status; `accepted` follows the status. */
  async update(
    workspaceId: string,
    repoId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionRecord | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.status !== undefined
          ? { status: patch.status, accepted: patch.status === 'accepted' }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.id, id),
        ),
      )
      .returning();
    return row ? toRecord(row) : undefined;
  }

  /**
   * Store one run's result (spec 004, step 5), in one transaction: drop the
   * repo's `pending` rows, keep `accepted` and `rejected`, insert each new
   * candidate whose rule matches no kept row, and record the run.
   */
  saveRun(
    workspaceId: string,
    repoId: string,
    found: GroundedConvention[],
    facts: ScanFacts,
    sha: string | null,
  ): Promise<void> {
    return this.db.transaction(async (tx) => {
      // Two runs of one repo must not interleave delete and insert: serialise per repo.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`conventions:${repoId}`}))`);
      const scope = and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId));
      await tx.delete(t.conventions).where(and(scope, eq(t.conventions.status, 'pending')));
      const kept = await tx
        .select({ rule: t.conventions.rule, extractedRule: t.conventions.extractedRule })
        .from(t.conventions)
        .where(scope);
      const known = new Set(
        kept.flatMap((k) => [k.rule, k.extractedRule ?? k.rule]).map(normaliseRule),
      );
      const fresh = found.filter((c) => !known.has(normaliseRule(c.rule)));
      await tx.insert(t.conventionScans).values({ workspaceId, repoId, ...facts, added: fresh.length });
      if (fresh.length === 0) return;
      await tx.insert(t.conventions).values(
        fresh.map((c) => ({
          workspaceId,
          repoId,
          rule: c.rule,
          extractedRule: c.rule,
          evidencePath: c.evidencePath,
          evidenceSnippet: c.evidenceSnippet,
          evidenceLineStart: c.evidenceLineStart,
          evidenceLineEnd: c.evidenceLineEnd,
          evidenceSha: sha,
          confidence: c.confidence,
          status: 'pending' as const,
          accepted: false,
        })),
      );
    });
  }
}

function toRecord(row: typeof t.conventions.$inferSelect): ConventionRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    repoId: row.repoId ?? '',
    rule: row.rule,
    evidencePath: row.evidencePath ?? '',
    evidenceSnippet: row.evidenceSnippet ?? '',
    evidenceLineStart: row.evidenceLineStart,
    evidenceLineEnd: row.evidenceLineEnd,
    evidenceSha: row.evidenceSha,
    confidence: row.confidence ?? 0,
    status: row.status,
    createdAt: row.createdAt,
  };
}
