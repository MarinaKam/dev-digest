import type {
  GitHubClient,
  PrCommentInput,
  PrDetail,
  PrMeta,
  PrReviewComment,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { Logger } from '../_shared/logger.js';
import { DIFF_STATS_BACKFILL_LIMIT } from './constants.js';
import { toPrListItem, toStoredPrDetail } from './helpers.js';
import type { DiffStats, PullRequest } from './types.js';

interface RepoRef {
  id: string;
  owner: string;
  name: string;
}

/**
 * Pull requests: import from GitHub (list + per-PR detail), the PR list with
 * its review and run figures, and inline review comments proxied to GitHub.
 *
 * Local-first: GitHub is used when a token is configured, but a read never
 * fails because of it — already imported pull requests stay viewable offline.
 * A review is never triggered from here.
 */
export class PullsService {
  constructor(private container: Container) {}

  private get pulls() {
    return this.container.pullsRepo;
  }

  /** PRs of a repo, synced from GitHub first when it can be reached. */
  async list(workspaceId: string, repoId: string, log?: Logger): Promise<PrMeta[]> {
    const repo = await this.requireRepo(workspaceId, repoId);
    const gh = await this.githubOrNull(log);

    if (gh) {
      try {
        const listed = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
        await this.pulls.upsertFromGitHub(workspaceId, repo.id, listed);
      } catch (err) {
        log?.warn({ err }, 'GitHub PR sync skipped (no token / offline); serving persisted PRs');
      }
    }

    const stored = await this.pulls.listForRepo(workspaceId, repo.id);
    const pulls = gh ? await this.backfillDiffStats(gh, repo, stored, log) : stored;
    const rollups = await this.pulls.rollupsFor(
      workspaceId,
      pulls.map((p) => p.id),
    );
    const now = Date.now();
    return pulls.map((pull) => toPrListItem(pull, rollups, now));
  }

  /** Full PR detail: refreshed from GitHub, or the stored one when it cannot be. */
  async detail(workspaceId: string, prId: string, log?: Logger): Promise<PrDetail> {
    const { pull, repo } = await this.requirePullAndRepo(workspaceId, prId);
    try {
      const gh = await this.container.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pull.number);
      await this.pulls.replaceDetail(pull.id, {
        body: detail.body ?? null,
        // Diff stats aren't on GitHub's PR-list payload — store them from the
        // detail fetch so the Pull Requests list shows real size/files.
        additions: detail.additions,
        deletions: detail.deletions,
        filesCount: detail.files_count,
        files: detail.files.map((f) => ({
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
        })),
        commits: detail.commits.map((c) => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          committedAt: c.committed_at ? new Date(c.committed_at) : null,
        })),
      });
      return { ...detail, id: pull.id };
    } catch (err) {
      log?.warn(
        { err },
        'GitHub PR detail refresh skipped (no token / offline); serving persisted detail',
      );
      const [files, commits] = await Promise.all([
        this.pulls.getFiles(pull.id),
        this.pulls.getCommits(pull.id),
      ]);
      return toStoredPrDetail(pull, files, commits);
    }
  }

  /** Inline review comments, live from GitHub (not stored). Empty when offline. */
  async listComments(workspaceId: string, prId: string, log?: Logger): Promise<PrReviewComment[]> {
    const { pull, repo } = await this.requirePullAndRepo(workspaceId, prId);
    const gh = await this.githubOrNull(log);
    if (!gh) return [];
    try {
      return await gh.listReviewComments({ owner: repo.owner, name: repo.name }, pull.number);
    } catch (err) {
      log?.warn({ err }, 'GitHub review-comments fetch skipped (offline / error)');
      return [];
    }
  }

  /** Create one inline review comment on GitHub, pinned to the PR's head commit. */
  async createComment(
    workspaceId: string,
    prId: string,
    input: PrCommentInput,
  ): Promise<PrReviewComment> {
    const { pull, repo } = await this.requirePullAndRepo(workspaceId, prId);
    let gh: GitHubClient;
    try {
      gh = await this.container.github();
    } catch {
      throw new AppError('github_unavailable', 'Connect a GitHub token to post comments.', 400);
    }
    try {
      return await gh.createReviewComment({ owner: repo.owner, name: repo.name }, pull.number, {
        commitId: pull.headSha,
        path: input.path,
        line: input.line,
        ...(input.side ? { side: input.side } : {}),
        body: input.body,
        ...(input.in_reply_to != null ? { inReplyTo: input.in_reply_to } : {}),
      });
    } catch (err) {
      // GitHub rejects comments on lines outside the diff / on closed PRs (422).
      const msg = err instanceof Error ? err.message : 'Failed to post the comment to GitHub.';
      throw new AppError('github_comment_failed', msg, 400, { cause: String(err) });
    }
  }

  // ---- internals -----------------------------------------------------------

  /**
   * Diff stats aren't on GitHub's PR-list payload, so freshly imported PRs land
   * with zeroed size. Fill them once from the detail endpoint so the list shows
   * real S/M/L and ± counts. Capped per request; the periodic refetch works
   * through any remainder. Returns the pull requests with the new stats.
   */
  private async backfillDiffStats(
    gh: GitHubClient,
    repo: RepoRef,
    pulls: PullRequest[],
    log?: Logger,
  ): Promise<PullRequest[]> {
    const missing = pulls
      .filter((p) => p.additions === 0 && p.deletions === 0 && p.filesCount === 0)
      .slice(0, DIFF_STATS_BACKFILL_LIMIT);
    const filled = new Map<string, DiffStats>();
    for (const pull of missing) {
      try {
        const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pull.number);
        const stats: DiffStats = {
          additions: detail.additions,
          deletions: detail.deletions,
          filesCount: detail.files_count,
        };
        await this.pulls.setDiffStats(pull.id, stats);
        filled.set(pull.id, stats);
      } catch (err) {
        log?.warn({ err, number: pull.number }, 'PR diff-stat backfill skipped');
      }
    }
    return pulls.map((pull) => ({ ...pull, ...filled.get(pull.id) }));
  }

  private async githubOrNull(log?: Logger): Promise<GitHubClient | null> {
    try {
      return await this.container.github();
    } catch (err) {
      log?.warn({ err }, 'GitHub client unavailable (no token / offline)');
      return null;
    }
  }

  private async requireRepo(workspaceId: string, repoId: string): Promise<RepoRef> {
    const repo = await this.container.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return repo;
  }

  private async requirePullAndRepo(
    workspaceId: string,
    prId: string,
  ): Promise<{ pull: PullRequest; repo: RepoRef }> {
    const pull = await this.pulls.getById(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const repo = await this.container.reposRepo.getById(workspaceId, pull.repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return { pull, repo };
  }
}
