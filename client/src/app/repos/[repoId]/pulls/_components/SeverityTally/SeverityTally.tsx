/* SeverityTally — compact "icon + count" per severity level that has findings,
   most severe first. Presentational: used in the PR list and in the run
   timeline. Renders nothing when every count is zero; the caller decides what
   an empty tally means there. */
import React from "react";
import { useTranslations } from "next-intl";
import { SEV, SeverityBadge } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";

const LEVELS = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[];

const rowStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4 };

export interface SeverityTallyProps {
  /** Findings per severity level. */
  counts: Record<Severity, number>;
}

export function SeverityTally({ counts }: SeverityTallyProps) {
  const t = useTranslations("prReview");
  const shown = LEVELS.filter((level) => counts[level] > 0);
  if (shown.length === 0) return null;
  return (
    <span style={rowStyle}>
      {shown.map((level) => {
        const label = t("panel.severityTally", { count: counts[level], level: SEV[level].label });
        return (
          <span key={level} role="img" aria-label={label} title={label}>
            <SeverityBadge severity={level} count={counts[level]} compact />
          </span>
        );
      })}
    </span>
  );
}
