/* RunCostBadge — the cost of a review run (or of a PR's runs), optionally with
   the run's in→out tokens. Presentational: the caller decides what the cost is
   and passes `null` whenever there is no cost data to show. */
import React from "react";
import { formatCost, formatTokensCompact } from "../../helpers";

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
};
const emptyStyle: React.CSSProperties = { ...baseStyle, color: "var(--text-muted)" };
const tokensStyle: React.CSSProperties = { color: "var(--text-muted)" };

export interface RunCostBadgeProps {
  /** Cost in USD. `null`/`undefined` = no cost data → "—". `0` is a real cost. */
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  /** `compact` → "$0.014"; `full` → "$0.014 · 8.2K→1.3K". */
  variant?: "compact" | "full";
}

export function RunCostBadge({ costUsd, tokensIn, tokensOut, variant = "compact" }: RunCostBadgeProps) {
  if (costUsd == null) {
    return (
      <span className="mono" style={emptyStyle}>
        {formatCost(null)}
      </span>
    );
  }
  // Explicit null checks: a token count of 0 is a value, not "missing".
  const showTokens = variant === "full" && tokensIn != null && tokensOut != null;
  return (
    <span className="mono tnum" style={baseStyle}>
      <span>{formatCost(costUsd)}</span>
      {showTokens && (
        <>
          <span style={tokensStyle}>·</span>
          <span style={tokensStyle}>{formatTokensCompact(tokensIn, tokensOut)}</span>
        </>
      )}
    </span>
  );
}
