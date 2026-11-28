/* FindingsTab — the "Agent runs" tab of a PR: live status of in-flight runs,
   the timeline (runs + commits) and one accordion per review run. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Button, SectionLabel, EmptyState } from "@devdigest/ui";
import type { PrCommit, ReviewRecord, RunSummary } from "@devdigest/shared";
import { useCancelRun, useDeleteRun, usePrReviews, usePrRuns } from "@/lib/hooks/reviews";
import { ReviewRunAccordion, type ScrollTarget } from "../ReviewRunAccordion";
import { RunHistory } from "../RunHistory";
import { RunStatus } from "../RunStatus";
import { countLethalTrifecta, findingsByRunId } from "./helpers";
import { s } from "./styles";

interface FindingsTabProps {
  prId: string;
  /** Ids of the runs in flight right now. */
  liveRunIds: string[];
  commits: PrCommit[];
  /** owner/repo + head sha — used to deep-link a finding's file:line to GitHub. */
  repoFullName?: string | null;
  headSha?: string | null;
  onOpenTrace: (runId: string) => void;
  /** Called when the live event streams of the in-flight runs have closed. */
  onRunDone: () => void;
}

const NO_REVIEWS: ReviewRecord[] = [];
const NO_RUNS: RunSummary[] = [];

export function FindingsTab({
  prId,
  liveRunIds,
  commits,
  repoFullName,
  headSha,
  onOpenTrace,
  onRunDone,
}: FindingsTabProps) {
  const t = useTranslations("prReview");
  // Reviews come newest-first; each is its own run (grouped into accordions).
  const { data: reviews = NO_REVIEWS } = usePrReviews(prId);
  const { data: runs = NO_RUNS } = usePrRuns(prId);
  const cancel = useCancelRun();
  const deleteRun = useDeleteRun(prId);
  // Timeline → Review-runs navigation: clicking an agent name in the timeline
  // opens + scrolls to that run's accordion below.
  const [scrollTarget, setScrollTarget] = React.useState<ScrollTarget | null>(null);

  const reviewRunning = liveRunIds.length > 0;
  const lethalTrifectaCount = countLethalTrifecta(reviews);

  const handleCancelAll = () => {
    for (const runId of liveRunIds) cancel.mutate(runId);
  };
  const handleOpenLiveTrace = () => {
    if (liveRunIds[0]) onOpenTrace(liveRunIds[0]);
  };
  const handleDeleteRun = (runId: string) => {
    if (window.confirm(t("timeline.deleteRunConfirm"))) deleteRun.mutate(runId);
  };
  const handleGoToReview = (runId: string) => {
    setScrollTarget((prev) => ({ runId, n: (prev?.n ?? 0) + 1 }));
  };

  return (
    <section>
      {reviewRunning && (
        <>
          <div style={s.liveRunSection}>
            <SectionLabel
              icon="Sparkles"
              right={
                <div style={s.cancelActions}>
                  <Button
                    kind="danger"
                    size="sm"
                    icon="X"
                    loading={cancel.isPending}
                    onClick={handleCancelAll}
                  >
                    {t("findingsTab.cancel")}
                  </Button>
                  <Button kind="ghost" size="sm" icon="FileText" onClick={handleOpenLiveTrace}>
                    {t("findingsTab.openRunTrace")}
                  </Button>
                </div>
              }
            >
              {t("findingsTab.liveReview")}
            </SectionLabel>
            <RunStatus runIds={liveRunIds} onDone={onRunDone} />
          </div>
          <div style={s.reviewInProgress}>
            <Icon.RefreshCw size={16} style={s.spinnerIcon} />
            <span style={s.reviewInProgressText}>{t("findingsTab.inProgress")}</span>
            <span style={s.reviewInProgressSub}>{t("findingsTab.inProgressHint")}</span>
          </div>
        </>
      )}

      {lethalTrifectaCount > 0 && (
        <div style={s.lethalTrifecta}>
          <Icon.Shield size={16} style={s.shieldIcon} />
          <span style={s.lethalTrifectaTitle}>{t("findingsTab.lethalTrifecta")}</span>
          <Badge color="var(--crit)" bg="transparent">
            {t("findingsTab.lethalTrifectaCount", { count: lethalTrifectaCount })}
          </Badge>
        </div>
      )}

      {(runs.length > 0 || commits.length > 0) && (
        <div style={s.timelineSection}>
          <SectionLabel
            icon="Activity"
            right={<span style={s.sectionNote}>{t("findingsTab.timelineNote")}</span>}
          >
            {t("findingsTab.timeline")}
          </SectionLabel>
          <RunHistory
            runs={runs}
            commits={commits}
            findingsByRun={findingsByRunId(reviews)}
            repoFullName={repoFullName}
            headSha={headSha}
            onOpenTrace={onOpenTrace}
            onGoToReview={handleGoToReview}
            onDelete={handleDeleteRun}
          />
        </div>
      )}

      <SectionLabel
        icon="AlertOctagon"
        right={<span style={s.sectionNote}>{t("findingsTab.reviewRunsNote")}</span>}
      >
        {t("findingsTab.reviewRuns")}
      </SectionLabel>
      {reviews.map((review, i) => (
        <ReviewRunAccordion
          key={review.id}
          review={review}
          run={runs.find((r) => r.run_id === review.run_id) ?? null}
          prId={prId}
          defaultOpen={i === 0}
          repoFullName={repoFullName}
          headSha={headSha}
          scrollTarget={scrollTarget}
        />
      ))}
      {reviews.length === 0 && !reviewRunning && (
        <EmptyState
          icon="Sparkles"
          title={t("findingsTab.emptyTitle")}
          body={t("findingsTab.emptyBody")}
        />
      )}
    </section>
  );
}
