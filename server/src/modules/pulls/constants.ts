/**
 * Max pull requests whose diff stats are backfilled from the GitHub detail
 * endpoint in one list request (each backfill is one detail fetch).
 */
export const DIFF_STATS_BACKFILL_LIMIT = 10;
