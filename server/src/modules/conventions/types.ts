import type { ConventionSampling, ConventionStatus } from '@devdigest/shared';

/**
 * Conventions domain values. The repository returns these; the service and the
 * pure helpers take them. None of them is inferred from a table.
 */

export interface ConventionRecord {
  id: string;
  workspaceId: string;
  repoId: string;
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  evidenceLineStart: number | null;
  evidenceLineEnd: number | null;
  evidenceSha: string | null;
  confidence: number;
  status: ConventionStatus;
  createdAt: Date;
}

/** A candidate that passed the evidence check, ready to be stored as `pending`. */
export interface GroundedConvention {
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  evidenceLineStart: number;
  evidenceLineEnd: number;
  confidence: number;
}

/** The files of one run and the commit of the clone they were read at. */
export interface SampleSet {
  files: SampledFile[];
  /** `null` when the clone's HEAD could not be read. */
  sha: string | null;
}

export interface ConventionPatch {
  rule?: string;
  status?: ConventionStatus;
}

/** One file as it was sent to the model: repo-relative path and the text sent. */
export interface SampledFile {
  path: string;
  text: string;
}

/** One rule as the model answered it, before the evidence check. */
export interface RawConvention {
  rule: string;
  evidence_path: string;
  line_start: number;
  line_end: number;
  evidence_snippet: string;
  confidence: number;
}

/** Where a snippet was found: 1-based inclusive lines and the file's own text. */
export interface SnippetMatch {
  start: number;
  end: number;
  text: string;
}

/** What one run read and proposed, stored with the run's result. */
export interface ScanFacts {
  sampling: ConventionSampling;
  filesSampled: number;
  proposed: number;
  kept: number;
  model: string;
  costUsd: number | null;
}

/** A stored run. `added` = kept rules that were new for the repo. */
export interface ConventionScanRecord extends ScanFacts {
  added: number;
  createdAt: Date;
}
