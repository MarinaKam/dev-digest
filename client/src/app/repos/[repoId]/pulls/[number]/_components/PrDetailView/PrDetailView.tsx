/* PrDetailView — /repos/:repoId/pulls/:number. Header (run a review), then one
   of three tabs: Overview, Agent runs (timeline + review runs + live status)
   and Files changed. The active tab and the open run trace live in the URL
   query (?tab, ?trace). */
"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import type { ReviewRecord } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { ApiError } from "@/lib/api";
import { githubPrUrl } from "@/lib/github-urls";
import { usePullDetail, usePulls } from "@/lib/hooks/pulls";
import { useLiveRuns, usePrReviews } from "@/lib/hooks/reviews";
import { useQueryParams } from "@/lib/query-params";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { DiffTab } from "../DiffTab";
import { FindingsTab } from "../FindingsTab";
import { OverviewTab } from "../OverviewTab";
import { PrDetailHeader } from "../PrDetailHeader";
import { RunTraceDrawer } from "../RunTraceDrawer";
import { DEFAULT_TAB, TAB_PARAM, TRACE_PARAM } from "./constants";
import { s } from "./styles";

const NO_REVIEWS: ReviewRecord[] = [];

export function PrDetailView() {
  const t = useTranslations("prReview");
  const { repoId, number } = useParams<{ repoId: string; number: string }>();
  const query = useQueryParams();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  // The route is keyed by PR number, but every PR API is keyed by the row's
  // uuid — resolve number → uuid via the (cached) pulls list before fetching.
  const { data: pulls, isLoading: pullsLoading } = usePulls(repoId);
  const prId = pulls?.find((p) => p.number === Number(number))?.id ?? null;
  const { data: pr, isLoading: detailLoading, isError, error, refetch } = usePullDetail(prId);
  const { data: reviews = NO_REVIEWS } = usePrReviews(prId);
  // Live run tracking is SERVER-SOURCED (agent_runs status='running'): survives
  // navigation AND reload, and self-clears via polling when runs finish.
  const { liveRunIds, refresh: refreshLiveRuns } = useLiveRuns(prId);

  const tab = query.get(TAB_PARAM) ?? DEFAULT_TAB;
  const traceRunId = query.get(TRACE_PARAM);
  const tracedReview = traceRunId ? reviews.find((r) => r.run_id === traceRunId) : undefined;
  const findingsCount = reviews.reduce((total, review) => total + review.findings.length, 0);

  // The real "owner/repo" (null until the repo is loaded) — used to build
  // github.com deep-links for the header and finding file references.
  const repoFullName = activeRepo?.full_name ?? null;
  const pullsHref = `/repos/${repoId}/pulls`;
  const crumb = [
    { label: repoFullName ?? repoId, mono: true, href: pullsHref },
    { label: t("list.breadcrumb"), href: pullsHref },
    { label: `#${number}`, mono: true },
  ];

  // Stale/unknown :repoId → friendly empty state instead of a 404 error.
  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  if (pullsLoading || (prId != null && detailLoading)) {
    return (
      <AppShell crumb={crumb}>
        <div style={s.loading}>
          <Skeleton height={28} width={420} />
          <Skeleton height={16} width={300} />
          <Skeleton height={200} />
        </div>
      </AppShell>
    );
  }

  if (isError || !pr || !prId) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("detail.loadErrorTitle")}
          body={error instanceof ApiError ? error.message : t("detail.loadErrorBody", { number })}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <PrDetailHeader
        pr={pr}
        prId={prId}
        tab={tab}
        findingsCount={findingsCount}
        githubUrl={repoFullName ? githubPrUrl(repoFullName, pr.number) : null}
        onSetTab={(next) => query.set(TAB_PARAM, next)}
        onRunStart={() => query.set(TAB_PARAM, "findings")}
      />

      <div style={s.body}>
        {tab === "overview" && <OverviewTab prBody={pr.body} />}

        {tab === "findings" && (
          <FindingsTab
            prId={prId}
            liveRunIds={liveRunIds}
            commits={pr.commits}
            repoFullName={repoFullName}
            headSha={pr.head_sha}
            onOpenTrace={(runId) => query.set(TRACE_PARAM, runId)}
            onRunDone={refreshLiveRuns}
          />
        )}

        {tab === "diff" && (
          <DiffTab
            prId={prId}
            filesCount={pr.files_count}
            files={pr.files}
            canComment={pr.status === "open"}
          />
        )}
      </div>

      {traceRunId && (
        <RunTraceDrawer
          runId={traceRunId}
          prNumber={pr.number}
          findings={tracedReview?.findings}
          agentName={tracedReview?.agent_name ?? null}
          onClose={() => query.set(TRACE_PARAM, null)}
        />
      )}
    </AppShell>
  );
}
