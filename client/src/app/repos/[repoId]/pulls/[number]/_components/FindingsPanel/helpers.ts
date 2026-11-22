import type { FindingRecord, Severity } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/** Number of findings per severity level; a level without findings is 0. */
export type SeverityCounts = Record<Severity, number>;

/** Count a run's findings per severity, regardless of confidence. */
export function countBySeverity(findings: FindingRecord[]): SeverityCounts {
  const count = (level: Severity) => findings.filter((f) => f.severity === level).length;
  // Written out so that a new severity level fails to compile here.
  return { CRITICAL: count("CRITICAL"), WARNING: count("WARNING"), SUGGESTION: count("SUGGESTION") };
}

/** Optionally drop low-confidence findings, keep one severity level, and sort by severity. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severity: Severity | null = null,
): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  if (severity) shown = shown.filter((f) => f.severity === severity);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}
