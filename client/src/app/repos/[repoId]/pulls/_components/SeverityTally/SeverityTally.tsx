/* SeverityTally — compact "icon + count" per severity level that has findings,
   most severe first. Presentational: used in the PR list and in the run
   timeline. Renders nothing when every count is zero; the caller decides what
   an empty tally means there. */
import type React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";

const LEVELS = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[];

const rowStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 12 };

function itemStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomStyle: "dotted",
    borderBottomColor: color,
    color,
    fontSize: 12,
    fontWeight: 600,
  };
}

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
        const sev = SEV[level];
        const LevelIcon = Icon[sev.icon];
        const label = t("panel.severityTally", { count: counts[level], level: sev.label });
        return (
          <span key={level} role="img" aria-label={label} className="tnum" style={itemStyle(sev.c)}>
            <LevelIcon size={12.5} aria-hidden />
            {counts[level]}
          </span>
        );
      })}
    </span>
  );
}
