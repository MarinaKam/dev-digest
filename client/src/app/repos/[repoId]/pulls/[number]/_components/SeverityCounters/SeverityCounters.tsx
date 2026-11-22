/* SeverityCounters — one counter per severity level for a review run. A click
   on a level asks the caller to filter the run's findings to it; a click on the
   active level asks to clear the filter. Presentational: the caller owns the
   counts and the active level. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITY_LEVELS } from "../FindingsPanel/constants";
import type { SeverityCounts } from "../FindingsPanel/helpers";
import { pillStyle, s } from "./styles";

export interface SeverityCountersProps {
  /** Findings of the run per level. A level with 0 is shown muted and disabled. */
  counts: SeverityCounts;
  /** The level the list is filtered to, or `null` when the filter is off. */
  active: Severity | null;
  /** Called with the clicked level, or with `null` when the active level is clicked. */
  onSelect: (severity: Severity | null) => void;
}

export function SeverityCounters({ counts, active, onSelect }: SeverityCountersProps) {
  const t = useTranslations("prReview");
  return (
    <div role="group" aria-label={t("panel.severityFilterLabel")} style={s.row}>
      {SEVERITY_LEVELS.map((level) => {
        const count = counts[level];
        const isActive = active === level;
        const isEmpty = count === 0;
        // While a filter is on, the levels it hides step back.
        const isDimmed = active !== null && !isActive;
        return (
          <button
            key={level}
            type="button"
            className="tnum"
            disabled={isEmpty}
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : level)}
            style={isEmpty ? s.empty : pillStyle(SEV[level].c, isActive, isDimmed)}
          >
            {t("panel.severityCount", { count, level: SEV[level].label.toUpperCase() })}
          </button>
        );
      })}
    </div>
  );
}
