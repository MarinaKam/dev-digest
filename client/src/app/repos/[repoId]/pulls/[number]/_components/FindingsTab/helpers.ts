import type { FindingRecord, ReviewRecord } from "@devdigest/shared";

/** Findings of each run whose review is loaded, keyed by run id. */
export function findingsByRunId(reviews: readonly ReviewRecord[]): Record<string, FindingRecord[]> {
  return Object.fromEntries(
    reviews.flatMap((review) => (review.run_id ? [[review.run_id, review.findings] as const] : [])),
  );
}

/** How many findings across the reviews are a "lethal trifecta". */
export function countLethalTrifecta(reviews: readonly ReviewRecord[]): number {
  return reviews
    .flatMap((review) => review.findings)
    .filter((finding) => finding.kind === "lethal_trifecta").length;
}
