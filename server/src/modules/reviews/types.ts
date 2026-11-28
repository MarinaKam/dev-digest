import type { CiFailOn, Provider, ReviewStrategy } from '@devdigest/shared';

/**
 * Review domain values. The repository returns these; the service, the run
 * executor and the pure helpers take them. None of them is inferred from a
 * table, and each states only what the review code needs.
 */

export interface ReviewRecord {
  id: string;
  workspaceId: string;
  prId: string;
  agentId: string | null;
  /** The agent run that produced this review. */
  runId: string | null;
  kind: 'summary' | 'review';
  verdict: string | null;
  summary: string | null;
  score: number | null;
  model: string | null;
  createdAt: Date;
}

export interface FindingRecord {
  id: string;
  reviewId: string;
  file: string;
  startLine: number;
  endLine: number;
  severity: string;
  category: string;
  title: string;
  rationale: string;
  suggestion: string | null;
  confidence: number;
  kind: string;
  trifectaComponents: string[] | null;
  acceptedAt: Date | null;
  dismissedAt: Date | null;
}

/** The pull request a review runs against. */
export interface ReviewedPull {
  id: string;
  workspaceId: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  base: string;
  headSha: string;
  body: string | null;
}

/** The repository the reviewed pull request belongs to. */
export interface ReviewedRepo {
  owner: string;
  name: string;
}

/** The agent config a review run executes. */
export interface ReviewAgent {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
  strategy: ReviewStrategy;
  ciFailOn: CiFailOn;
  repoIntel: boolean;
  version: number;
}

/** One stored file patch of a pull request. */
export interface PrFilePatch {
  path: string;
  patch: string | null;
}
