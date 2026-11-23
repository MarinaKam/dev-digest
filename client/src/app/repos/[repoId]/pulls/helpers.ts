import { SIZE_MEDIUM_MAX, SIZE_SMALL_MAX, type PrMeta, type SizeInfo } from "./constants";
import type { FindingRecord, ReviewRecord } from "@devdigest/shared";
import { SEVERITY_ORDER } from "./[number]/_components/FindingsPanel/constants";

/** Bucket a PR into S/M/L by total changed lines. */
export function sizeOf(pr: PrMeta): SizeInfo {
  const lines = pr.additions + pr.deletions;
  const size = lines < SIZE_SMALL_MAX ? "S" : lines < SIZE_MEDIUM_MAX ? "M" : "L";
  return { size, lines };
}

/** Shown wherever there is no cost data. Never "$0.00": zero is a real cost. */
const NO_COST = "—";
/** Costs below $1 keep at least this many significant digits… */
const COST_SIGNIFICANT_DIGITS = 3;
/** …and at least this many decimals. */
const COST_MIN_DECIMALS = 3;
/** Decimals for $1 and above, and for an exact zero. */
const COST_WHOLE_DECIMALS = 2;

/**
 * Run cost in USD for display. `null`/`undefined` (no cost data) → "—";
 * `0` (free model) → "$0.00". Below $1 the value is rounded to 3 significant
 * digits and keeps at least 3 decimals, so a tiny cost never collapses to
 * zero: 0.0004 → "$0.0004", 0.014 → "$0.014", 0.01234 → "$0.0123".
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd < 0) return NO_COST;
  if (usd === 0 || usd >= 1) return `$${usd.toFixed(COST_WHOLE_DECIMALS)}`;

  // Decimals needed to show COST_SIGNIFICANT_DIGITS digits of a value below 1.
  const leadingZeros = -Math.floor(Math.log10(usd)) - 1;
  const decimals = Math.max(COST_MIN_DECIMALS, leadingZeros + COST_SIGNIFICANT_DIGITS);
  const fixed = usd.toFixed(decimals);
  // Rounding can carry a value like 0.9996 up to 1.
  if (Number(fixed) >= 1) return `$${Number(fixed).toFixed(COST_WHOLE_DECIMALS)}`;

  const [whole, fraction = ""] = fixed.split(".");
  const trimmed = fraction.replace(/0+$/, "").padEnd(COST_MIN_DECIMALS, "0");
  return `$${whole}.${trimmed}`;
}

/**
 * The cost a run may display. A cost belongs to a COMPLETED run only: a run
 * that is running, failed or cancelled shows no price even if a number is
 * present. `0` is kept (free model); "no data" is `null`.
 */
export function completedRunCost(
  run: { status: string | null; cost_usd?: number | null } | null | undefined,
): number | null {
  if (!run || run.status !== "done") return null;
  return run.cost_usd ?? null;
}

/** Token in→out summary in thousands with one decimal (e.g. "8.2K→1.3K"). */
export function formatTokensCompact(tokensIn: number, tokensOut: number): string {
  const k = (n: number) => `${(n / 1000).toFixed(1)}K`;
  return `${k(tokensIn)}→${k(tokensOut)}`;
}

/** Compact relative time for the list's UPDATED column (e.g. "3h", "2d"). */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const m = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/**
 * The PR's current findings: those of each agent's latest review, most severe
 * first. An older review by the same agent is superseded. Mirrors what the
 * list endpoint counts into `findings_by_severity`.
 */
export function currentFindings(reviews: readonly ReviewRecord[]): FindingRecord[] {
  const newestFirst = [...reviews]
    .filter((review) => review.kind === "review")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const seenAgents = new Set<string>();
  const latestPerAgent = newestFirst.filter((review) => {
    const agent = review.agent_id ?? "";
    if (seenAgents.has(agent)) return false;
    seenAgents.add(agent);
    return true;
  });
  return latestPerAgent
    .flatMap((review) => review.findings)
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
}
