/* PullsView — /repos/:repoId/pulls. The PR table with its filter bar. The
   status filter and the sort order live in the URL query (?status, ?sort). */
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AutoTriggerStatus } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { usePulls } from "@/lib/hooks/pulls";
import { useRefreshRepo } from "@/lib/hooks/repos";
import { useQueryParams } from "@/lib/query-params";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { COLUMN_KEYS, DEFAULT_STATUS, OPEN_STATUSES, SORT_NEWEST } from "../../constants";
import { filterPulls } from "../../helpers";
import { s } from "../../styles";
import { FilterBar } from "../FilterBar";
import { PullsList } from "../PullsList";

const STATUS_PARAM = "status";
const SORT_PARAM = "sort";

export function PullsView() {
  const t = useTranslations("prReview");
  const { repoId } = useParams<{ repoId: string }>();
  const params = useQueryParams();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { data: pulls, isLoading, error, refetch } = usePulls(repoId);
  const refresh = useRefreshRepo();
  // The text filter is typed, not linked to: it stays local to the screen.
  const [query, setQuery] = React.useState("");

  const status = params.get(STATUS_PARAM) ?? DEFAULT_STATUS;
  const sort = params.get(SORT_PARAM) ?? SORT_NEWEST;
  const all = pulls ?? [];
  const openCount = all.filter((pr) => OPEN_STATUSES.has(pr.status)).length;
  const needsReviewCount = all.filter((pr) => pr.status === DEFAULT_STATUS).length;
  const crumb = [{ label: activeRepo?.full_name ?? repoId, mono: true }, { label: t("list.breadcrumb") }];

  // Stale/unknown :repoId → friendly empty state instead of a 404 error.
  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>{t("list.title")}</h1>
          <p style={s.pageSubtitle}>
            {pulls
              ? t("list.summary", { open: openCount, needsReview: needsReviewCount })
              : t("list.loading")}
          </p>
        </div>
        <div style={s.headerActions}>
          <AutoTriggerStatus on={false} />
        </div>
      </div>

      <div style={s.tableCard}>
        <FilterBar
          active={status}
          // Always explicit, so that "all" sticks over the needs-review default.
          onActive={(next) => params.set(STATUS_PARAM, next)}
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={(next) => params.set(SORT_PARAM, next)}
          onRefresh={() => refresh.mutate(repoId)}
          refreshing={refresh.isPending}
        />
        <div style={s.headRow}>
          {COLUMN_KEYS.map((key, column) => (
            <div key={key} style={s.headCell(column === COLUMN_KEYS.length - 1)}>
              {t(`list.columns.${key}`)}
            </div>
          ))}
        </div>
        <PullsList
          pulls={filterPulls(all, { status, query, sort })}
          repoId={repoId}
          repoFullName={activeRepo?.full_name}
          status={status}
          loading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    </AppShell>
  );
}
