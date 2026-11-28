/* FindingsPanel — severity counters + hide-low-confidence + j/k navigation +
   FindingCard list, wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { SeverityCounters } from "../SeverityCounters";
import { useFindingAction } from "@/lib/hooks/reviews";
import { KEY_TO_ACTION } from "./constants";
import { countBySeverity, visibleFindings } from "../../../helpers";
import { s } from "./styles";

interface FindingsPanelProps {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}

export function FindingsPanel({ findings, prId, repoFullName, headSha }: FindingsPanelProps) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [focusIdx, setFocusIdx] = React.useState(0);

  const [selected, setSelected] = React.useState<Severity | null>(null);

  const counts = React.useMemo(() => countBySeverity(findings), [findings]);
  // A level that lost all its findings cannot be un-clicked (its counter is
  // disabled), so a filter on it is ignored at once (derived, no state change)…
  const severity = selected && counts[selected] > 0 ? selected : null;
  // …and then dropped for good, so that it does not come back by itself if the
  // level gets findings again.
  const selectedIsEmpty = selected !== null && counts[selected] === 0;
  React.useEffect(() => {
    if (!selectedIsEmpty) return;
    setSelected(null);
    setFocusIdx(0);
  }, [selectedIsEmpty]);
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, severity),
    [findings, hideLow, severity],
  );

  const selectSeverity = (next: Severity | null) => {
    setSelected(next);
    setFocusIdx(0);
  };

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        {findings.length > 0 && (
          <>
            <SeverityCounters counts={counts} active={severity} onSelect={selectSeverity} />
            <span style={s.divider} aria-hidden />
          </>
        )}
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
