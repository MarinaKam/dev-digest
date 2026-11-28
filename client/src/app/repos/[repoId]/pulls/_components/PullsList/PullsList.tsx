"use client";

import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { PrMeta } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { ALL_STATUSES, SKELETON_ROWS } from "../../constants";
import { s } from "../../styles";
import { PRRow } from "../PRRow";

const SKELETON_KEYS = Array.from({ length: SKELETON_ROWS }, (_, row) => `skeleton-${row}`);

interface PullsListProps {
  /** The PRs to show, already filtered and sorted. */
  pulls: PrMeta[];
  repoId: string;
  repoFullName?: string | null;
  /** Active status filter — words the empty state. */
  status: string;
  loading: boolean;
  /** The load error, or null when the list loaded. */
  error: unknown;
  onRetry: () => void;
}

/** The body of the PR table: its loading, error and empty states, or the rows. */
export function PullsList({ pulls, repoId, repoFullName, status, loading, error, onRetry }: PullsListProps) {
  const t = useTranslations("prReview");

  if (loading) {
    return (
      <div style={s.loadingStack}>
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} height={28} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t("list.errorTitle")}
        body={error instanceof ApiError ? error.message : t("list.errorBody")}
        onRetry={onRetry}
      />
    );
  }

  if (pulls.length === 0) {
    return (
      <EmptyState
        icon="GitPullRequest"
        title={t("list.emptyTitle")}
        body={status === ALL_STATUSES ? t("list.emptyAllBody") : t("list.emptyStatusBody", { status })}
      />
    );
  }

  return pulls.map((pr) => <PRRow key={pr.number} pr={pr} repoId={repoId} repoFullName={repoFullName} />);
}
