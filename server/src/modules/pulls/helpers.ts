import type { PrDetail, PrMeta } from '@devdigest/shared';
import { deriveReviewStatus } from './status.js';
import type { PullCommit, PullFile, PullRequest, PullRollups } from './types.js';

/** Pure mappers from pull request domain values to the API contract. */

function toBaseMeta(pull: PullRequest) {
  return {
    id: pull.id,
    number: pull.number,
    title: pull.title,
    author: pull.author,
    branch: pull.branch,
    base: pull.base,
    head_sha: pull.headSha,
    additions: pull.additions,
    deletions: pull.deletions,
    files_count: pull.filesCount,
    opened_at: pull.openedAt?.toISOString() ?? null,
    updated_at: pull.updatedAt?.toISOString() ?? null,
  };
}

/** One row of the PR list: the pull request plus its review and run figures. */
export function toPrListItem(pull: PullRequest, rollups: PullRollups, now: number): PrMeta {
  const reviewed = rollups.scoreByPr.has(pull.id);
  const found = reviewed ? (rollups.findingsByPr.get(pull.id) ?? {}) : null;
  return {
    ...toBaseMeta(pull),
    status: deriveReviewStatus({
      ghStatus: pull.status,
      lastReviewedSha: pull.lastReviewedSha,
      headSha: pull.headSha,
      updatedAt: pull.updatedAt,
      now,
    }),
    score: rollups.scoreByPr.get(pull.id) ?? null,
    cost_usd: rollups.costByPr.get(pull.id) ?? null,
    active_runs: rollups.activeRunsByPr.get(pull.id) ?? 0,
    findings_by_severity: found && {
      CRITICAL: found.CRITICAL ?? 0,
      WARNING: found.WARNING ?? 0,
      SUGGESTION: found.SUGGESTION ?? 0,
    },
  };
}

/** The stored detail of a pull request (served when GitHub cannot be reached). */
export function toStoredPrDetail(
  pull: PullRequest,
  files: PullFile[],
  commits: PullCommit[],
): PrDetail {
  return {
    ...toBaseMeta(pull),
    status: pull.status as PrDetail['status'],
    body: pull.body,
    files: files.map((f) => ({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
    commits: commits.map((c) => ({
      sha: c.sha,
      message: c.message,
      author: c.author,
      committed_at: c.committedAt?.toISOString() ?? null,
    })),
  };
}
