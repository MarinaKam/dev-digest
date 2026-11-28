import { and, count, desc, eq, inArray, isNotNull, sum } from 'drizzle-orm';
import type { PrMeta } from '@devdigest/shared';
import type { DbExecutor } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type {
  DiffStats,
  PullCommit,
  PullDetailUpdate,
  PullFile,
  PullRequest,
  PullRollups,
} from './types.js';

/**
 * Pull request data access. The ONLY writer of `pull_requests`, `pr_files` and
 * `pr_commits`: every module that imports or updates a pull request goes
 * through this class (`container.pullsRepo`).
 */
export class PullsRepository {
  constructor(private db: DbExecutor) {}

  async getById(workspaceId: string, id: string): Promise<PullRequest | undefined> {
    const [row] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, id)));
    return row;
  }

  async listForRepo(workspaceId: string, repoId: string): Promise<PullRequest[]> {
    return this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.repoId, repoId)));
  }

  /**
   * Import pull requests from GitHub's list payload. Idempotent on
   * (repo, number): a PR that is already stored only gets the fields GitHub
   * changes between polls. The list payload carries no diff stats, so they are
   * not overwritten on an update. One transaction: a sync stores the whole list
   * or nothing.
   */
  upsertFromGitHub(workspaceId: string, repoId: string, pulls: PrMeta[]): Promise<void> {
    return this.db.transaction(async (tx) => {
      for (const pr of pulls) {
        const updatedAt = pr.updated_at ? new Date(pr.updated_at) : null;
        await tx
          .insert(t.pullRequests)
          .values({
            workspaceId,
            repoId,
            number: pr.number,
            title: pr.title,
            author: pr.author,
            branch: pr.branch,
            base: pr.base,
            headSha: pr.head_sha,
            additions: pr.additions,
            deletions: pr.deletions,
            filesCount: pr.files_count,
            status: pr.status,
            openedAt: pr.opened_at ? new Date(pr.opened_at) : null,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: [t.pullRequests.repoId, t.pullRequests.number],
            set: { title: pr.title, headSha: pr.head_sha, status: pr.status, updatedAt },
          });
      }
    });
  }

  async setDiffStats(id: string, stats: DiffStats): Promise<void> {
    await this.db
      .update(t.pullRequests)
      .set({
        additions: stats.additions,
        deletions: stats.deletions,
        filesCount: stats.filesCount,
      })
      .where(eq(t.pullRequests.id, id));
  }

  /**
   * Store a refreshed detail: files, commits, body and diff stats, as one
   * transaction. When any part cannot be stored, the previous detail stays.
   */
  replaceDetail(id: string, detail: PullDetailUpdate): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx.delete(t.prFiles).where(eq(t.prFiles.prId, id));
      if (detail.files.length > 0) {
        await tx.insert(t.prFiles).values(detail.files.map((f) => ({ prId: id, ...f })));
      }
      await tx.delete(t.prCommits).where(eq(t.prCommits.prId, id));
      if (detail.commits.length > 0) {
        await tx.insert(t.prCommits).values(detail.commits.map((c) => ({ prId: id, ...c })));
      }
      await tx
        .update(t.pullRequests)
        .set({
          body: detail.body,
          additions: detail.additions,
          deletions: detail.deletions,
          filesCount: detail.filesCount,
        })
        .where(eq(t.pullRequests.id, id));
    });
  }

  async getFiles(id: string): Promise<PullFile[]> {
    return this.db
      .select({
        path: t.prFiles.path,
        additions: t.prFiles.additions,
        deletions: t.prFiles.deletions,
        patch: t.prFiles.patch,
      })
      .from(t.prFiles)
      .where(eq(t.prFiles.prId, id));
  }

  async getCommits(id: string): Promise<PullCommit[]> {
    return this.db
      .select({
        sha: t.prCommits.sha,
        message: t.prCommits.message,
        author: t.prCommits.author,
        committedAt: t.prCommits.committedAt,
      })
      .from(t.prCommits)
      .where(eq(t.prCommits.prId, id));
  }

  /**
   * Record the commit a review just ran against, so the PR list can derive
   * `reviewed` vs `needs_review` (head moved since the last review) vs `stale`.
   */
  async markReviewed(id: string, sha: string): Promise<void> {
    await this.db
      .update(t.pullRequests)
      .set({ lastReviewedSha: sha })
      .where(eq(t.pullRequests.id, id));
  }

  /**
   * Read model for the PR list: everything the list shows per PR that comes
   * from reviews and runs, in one grouped query per figure over all listed ids.
   * Read-only; never reuse it for a write.
   */
  async rollupsFor(workspaceId: string, prIds: string[]): Promise<PullRollups> {
    if (prIds.length === 0) {
      return {
        scoreByPr: new Map(),
        findingsByPr: new Map(),
        activeRunsByPr: new Map(),
        costByPr: new Map(),
      };
    }
    const latest = await this.latestReviews(prIds);
    const [findingsByPr, activeRunsByPr, costByPr] = await Promise.all([
      this.findingsByPr(latest.prByAgentReview),
      this.activeRunsByPr(workspaceId, prIds),
      this.costByPr(workspaceId, prIds),
    ]);
    return { scoreByPr: latest.scoreByPr, findingsByPr, activeRunsByPr, costByPr };
  }

  /**
   * The latest review per PR (its score) and the latest review of each agent
   * per PR (review id -> PR id), from one query ordered newest first.
   */
  private async latestReviews(prIds: string[]): Promise<{
    scoreByPr: Map<string, number | null>;
    prByAgentReview: Map<string, string>;
  }> {
    const rows = await this.db
      .select({
        id: t.reviews.id,
        prId: t.reviews.prId,
        agentId: t.reviews.agentId,
        score: t.reviews.score,
      })
      .from(t.reviews)
      .where(and(inArray(t.reviews.prId, prIds), eq(t.reviews.kind, 'review')))
      .orderBy(desc(t.reviews.createdAt));
    const scoreByPr = new Map<string, number | null>();
    const prByAgentReview = new Map<string, string>();
    const seenAgents = new Set<string>();
    for (const rv of rows) {
      // Rows are newest-first: the first seen per PR is the latest review…
      if (!scoreByPr.has(rv.prId)) scoreByPr.set(rv.prId, rv.score);
      // …and the first seen per PR + agent is that agent's latest review.
      const agentKey = `${rv.prId}:${rv.agentId ?? ''}`;
      if (!seenAgents.has(agentKey)) {
        seenAgents.add(agentKey);
        prByAgentReview.set(rv.id, rv.prId);
      }
    }
    return { scoreByPr, prByAgentReview };
  }

  /**
   * Findings per severity, summed over each agent's latest review of the PR.
   * An older review by the same agent is superseded and not counted. A PR whose
   * reviews found nothing is absent from the map.
   */
  private async findingsByPr(
    prByReview: Map<string, string>,
  ): Promise<Map<string, Record<string, number>>> {
    const out = new Map<string, Record<string, number>>();
    if (prByReview.size === 0) return out;
    const rows = await this.db
      .select({
        reviewId: t.findings.reviewId,
        severity: t.findings.severity,
        total: count().mapWith(Number),
      })
      .from(t.findings)
      .where(inArray(t.findings.reviewId, [...prByReview.keys()]))
      .groupBy(t.findings.reviewId, t.findings.severity);
    for (const row of rows) {
      const prId = prByReview.get(row.reviewId);
      if (prId == null) continue;
      const counts = out.get(prId) ?? {};
      out.set(prId, { ...counts, [row.severity]: (counts[row.severity] ?? 0) + row.total });
    }
    return out;
  }

  /**
   * Runs still running per PR. Runs left 'running' by a dead process are reaped
   * on boot, so a row here is live.
   */
  private async activeRunsByPr(workspaceId: string, prIds: string[]): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ prId: t.agentRuns.prId, total: count().mapWith(Number) })
      .from(t.agentRuns)
      .where(
        and(
          eq(t.agentRuns.workspaceId, workspaceId),
          inArray(t.agentRuns.prId, prIds),
          eq(t.agentRuns.status, 'running'),
        ),
      )
      .groupBy(t.agentRuns.prId);
    const out = new Map<string, number>();
    for (const row of rows) {
      if (row.prId != null) out.set(row.prId, row.total);
    }
    return out;
  }

  /**
   * Cost per PR: the sum over the PR's COMPLETED runs that have cost data. A PR
   * with no such run is absent from the map and reads as null, never as 0 — 0
   * is a real cost (free model).
   */
  private async costByPr(workspaceId: string, prIds: string[]): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ prId: t.agentRuns.prId, total: sum(t.agentRuns.costUsd).mapWith(Number) })
      .from(t.agentRuns)
      .where(
        and(
          eq(t.agentRuns.workspaceId, workspaceId),
          inArray(t.agentRuns.prId, prIds),
          eq(t.agentRuns.status, 'done'),
          isNotNull(t.agentRuns.costUsd),
        ),
      )
      .groupBy(t.agentRuns.prId);
    const out = new Map<string, number>();
    for (const row of rows) {
      if (row.prId != null && row.total != null) out.set(row.prId, row.total);
    }
    return out;
  }
}
