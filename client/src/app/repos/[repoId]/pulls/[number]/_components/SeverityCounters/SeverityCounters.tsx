/* SeverityCounters — one counter per severity level for a review run. A click
   on a level asks the caller to filter the run's findings to it; a click on the
   active level asks to clear the filter. Presentational: the caller owns the
   counts and the active level. */
"use client";

import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITY_LEVELS } from "../../../constants";
import type { SeverityCounts } from "../../../helpers";
import { activePillStyle, s } from "./styles";

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
    <fieldset aria-label={t("panel.severityFilterLabel")} style={s.row}>
      {SEVERITY_LEVELS.map((level) => {
        const count = counts[level];
        const isActive = active === level;
        const isEmpty = count === 0;
        const sev = SEV[level];
        const LevelIcon = Icon[sev.icon];
        const style = isEmpty ? s.empty : isActive ? activePillStyle(sev.c, sev.bg) : s.pill;
        return (
          <button
            key={level}
            type="button"
            className="tnum"
            disabled={isEmpty}
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : level)}
            style={style}
          >
            <LevelIcon size={12} aria-hidden />
            {t("panel.severityCount", { count, level: sev.label })}
          </button>
        );
      })}
    </fieldset>
  );
}
