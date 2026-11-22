/* RunFindingsPopover — the severity tally of one run. Hovering it previews the
   run's findings; clicking it pins the list open so its links can be used. Each
   finding shows severity, title, category, file:line, confidence and the start
   of the rationale. The file opens on GitHub; the title jumps to the run's
   findings below, where a finding is accepted or dismissed. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CategoryTag, Icon, MonoLink, SEV } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { SeverityTally } from "../../../_components/SeverityTally";
import { githubBlobUrl } from "../../../../../../../lib/github-urls";
import { lineLabel } from "../FindingCard/helpers";
import { countBySeverity, visibleFindings } from "../FindingsPanel/helpers";
import { s } from "./styles";

const PERCENT = 100;

export interface RunFindingsPopoverProps {
  /** All findings of the run. */
  findings: FindingRecord[];
  /** owner/repo + head sha — when both are known, file:line links to GitHub. */
  repoFullName?: string | null;
  headSha?: string | null;
  /** Jump to this run's findings below (clicking a finding's title). */
  onGoToReview?: () => void;
}

export function RunFindingsPopover({
  findings,
  repoFullName,
  headSha,
  onGoToReview,
}: RunFindingsPopoverProps) {
  const t = useTranslations("prReview");
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const counts = React.useMemo(() => countBySeverity(findings), [findings]);
  const sorted = React.useMemo(() => visibleFindings(findings, false), [findings]);

  // A pinned list closes on Escape or on a click anywhere outside it.
  React.useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPinned(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [pinned]);

  if (findings.length === 0) return null;
  const open = hovered || pinned;
  const heading = t("timeline.findingsInRun", { count: findings.length });
  return (
    <span
      ref={rootRef}
      style={s.anchor}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        style={s.trigger}
      >
        <SeverityTally counts={counts} />
      </button>
      {open && (
        <div style={s.bridge}>
          <div role="dialog" aria-label={heading} style={s.panel}>
            <div style={s.heading}>
              <Icon.FileText size={12} aria-hidden />
              {heading}
            </div>
            <ul style={s.list}>
              {sorted.map((f) => {
                const sev = SEV[f.severity];
                const LevelIcon = Icon[sev.icon];
                const where = `${f.file}:${lineLabel(f)}`;
                const href =
                  repoFullName && headSha
                    ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line)
                    : undefined;
                return (
                  <li key={f.id} style={s.item}>
                    <div style={s.titleRow}>
                      <LevelIcon size={13} style={{ color: sev.c, flexShrink: 0 }} aria-label={sev.label} />
                      <button
                        type="button"
                        title={f.title}
                        style={s.title}
                        onClick={() => {
                          setPinned(false);
                          setHovered(false);
                          onGoToReview?.();
                        }}
                      >
                        {f.title}
                      </button>
                      <CategoryTag category={f.category} />
                    </div>
                    <div className="mono" style={s.meta}>
                      <span style={s.file}>
                        {href ? <MonoLink href={href}>{where}</MonoLink> : where}
                      </span>
                      <span className="tnum" style={s.conf}>
                        {Math.round(f.confidence * PERCENT)}% conf
                      </span>
                    </div>
                    <div style={s.rationale}>{f.rationale}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </span>
  );
}
