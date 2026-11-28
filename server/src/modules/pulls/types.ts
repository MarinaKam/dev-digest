/**
 * Pull request domain values. The repository returns these; the service and the
 * pure helpers take them. None of them is inferred from a table.
 */

export interface PullRequest {
  id: string;
  workspaceId: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  headSha: string;
  lastReviewedSha: string | null;
  additions: number;
  deletions: number;
  filesCount: number;
  /** GitHub's merge state: open / merged / closed. */
  status: string;
  body: string | null;
  openedAt: Date | null;
  updatedAt: Date | null;
}

export interface PullFile {
  path: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface PullCommit {
  sha: string;
  message: string;
  author: string;
  committedAt: Date | null;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  filesCount: number;
}

/** What a detail refresh stores for one pull request, as one unit. */
export interface PullDetailUpdate extends DiffStats {
  body: string | null;
  files: PullFile[];
  commits: PullCommit[];
}

/**
 * Per-PR figures for the list screen, each keyed by pull request id. A PR that
 * is absent from a map has no value for that figure.
 */
export interface PullRollups {
  /** Score of the PR's latest review. */
  scoreByPr: ReadonlyMap<string, number | null>;
  /** Findings per severity, summed over each agent's latest review of the PR. */
  findingsByPr: ReadonlyMap<string, Readonly<Record<string, number>>>;
  /** Review runs still running. */
  activeRunsByPr: ReadonlyMap<string, number>;
  /** Sum of the cost of the PR's completed runs that have cost data. */
  costByPr: ReadonlyMap<string, number>;
}
