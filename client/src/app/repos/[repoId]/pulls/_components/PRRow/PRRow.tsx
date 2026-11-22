/* PRRow — one clickable row in the PR list table. Ported from screen_dashboard.jsx. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon, Avatar, Badge, CircularScore } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";
import { SIZE_COLOR, STATUS_META } from "../../constants";
import { relativeTime, sizeOf } from "../../helpers";
import { s } from "../../styles";
import { RunCostBadge } from "../RunCostBadge";
import { FindingsPopover } from "../FindingsPopover";
import { usePrReviews } from "@/lib/hooks/reviews";
import { currentFindings } from "../../helpers";

const reviewingStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--accent-text)",
  whiteSpace: "nowrap",
};
// `ddspin` is the global spin keyframe of the UI kit (src/vendor/ui/styles.css),
// the same one the "Review in progress…" banner on the PR page uses.
const spinnerStyle: React.CSSProperties = { animation: "ddspin 1s linear infinite" };

export function PRRow({
  pr,
  repoId,
  repoFullName,
}: {
  pr: PrMeta;
  repoId: string;
  /** owner/repo — lets a finding's file:line in the findings list link to GitHub. */
  repoFullName?: string | null;
}) {
  const t = useTranslations("prReview");
  const router = useRouter();
  const [h, setH] = React.useState(false);
  const st = STATUS_META[pr.status] ?? STATUS_META.needs_review!;
  const { size, lines } = sizeOf(pr);
  const reviewed = pr.score != null; // null score ⇒ PR has never been reviewed
  const activeRuns = pr.active_runs ?? 0;
  const found = pr.findings_by_severity ?? null; // null ⇒ never reviewed
  const foundTotal = found ? found.CRITICAL + found.WARNING + found.SUGGESTION : 0;
  // The list endpoint carries counts only; the findings themselves are loaded
  // the first time this row's findings list is opened.
  const [findingsOpened, setFindingsOpened] = React.useState(false);
  const { data: reviews } = usePrReviews(findingsOpened ? pr.id : null);
  const listedFindings = React.useMemo(
    () => (reviews ? currentFindings(reviews) : undefined),
    [reviews],
  );
  const handleFindingsOpen = React.useCallback((open: boolean) => {
    if (open) setFindingsOpened(true);
  }, []);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={() => router.push(`/repos/${repoId}/pulls/${pr.number}`)}
      style={s.row(h)}
    >
      <div style={s.rowTitleCell}>
        <Icon.GitPullRequest size={15} style={s.rowIcon(st.c)} />
        <div style={s.rowTitleWrap}>
          <div style={s.rowTitle(h)}>{pr.title}</div>
          <span className="mono" style={s.rowNumber}>
            #{pr.number}
          </span>
        </div>
      </div>
      <div style={s.authorCell}>
        <Avatar name={pr.author} size={18} />
        {pr.author}
      </div>
      <div>
        <Badge
          color={SIZE_COLOR[size]}
          bg="transparent"
          style={s.sizeBadgeBorder(SIZE_COLOR[size]!)}
        >
          {size} · {lines}
        </Badge>
      </div>
      <div style={s.scoreCell}>
        {reviewed ? (
          <CircularScore score={pr.score!} size={34} stroke={3} />
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      <div data-testid="pr-findings">
        {found === null ? (
          <span style={s.muted}>—</span>
        ) : foundTotal === 0 ? (
          <span className="tnum" style={s.muted}>
            0
          </span>
        ) : (
          <FindingsPopover
            counts={found}
            findings={listedFindings}
            heading={t("popover.findingsInPr", { count: foundTotal })}
            repoFullName={repoFullName}
            headSha={pr.head_sha}
            onOpenChange={handleFindingsOpen}
            onSelect={() => router.push(`/repos/${repoId}/pulls/${pr.number}?tab=findings`)}
          />
        )}
      </div>
      <div>
        {activeRuns > 0 ? (
          <span role="status" style={reviewingStyle}>
            <Icon.RefreshCw size={12} style={spinnerStyle} aria-hidden />
            {t("list.status.reviewing", { count: activeRuns })}
          </span>
        ) : (
          <Badge dot color={st.c} bg="transparent">
            {t(`list.status.${st.labelKey}`)}
          </Badge>
        )}
      </div>
      <div data-testid="pr-cost">
        <RunCostBadge costUsd={pr.cost_usd} />
      </div>
      <div style={s.updatedCell}>{relativeTime(pr.updated_at)}</div>
    </div>
  );
}
