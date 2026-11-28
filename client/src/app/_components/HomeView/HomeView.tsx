/* HomeView — / . Sends the user to the active repo's PR list (the one last
   opened or picked, else the first), or offers to add a repository when there
   is none. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-shell";
import { ApiError } from "@/lib/api";
import { useRepos } from "@/lib/hooks/repos";
import { useActiveRepo } from "@/lib/repo-context";
import { s } from "./styles";

export function HomeView() {
  const t = useTranslations("home");
  const router = useRouter();
  const { isLoading, error, refetch } = useRepos();
  const { activeRepo, ready } = useActiveRepo();
  // Wait until the stored choice was read, or the first repo would win the race.
  const target = ready ? activeRepo : null;
  const targetHref = target ? `/repos/${target.id}/pulls` : null;

  // Navigation is the side effect here: the start page has no content of its
  // own once a repository exists.
  React.useEffect(() => {
    if (targetHref) router.replace(targetHref);
  }, [targetHref, router]);

  return (
    <AppShell crumb={[{ label: t("breadcrumb") }]}>
      <PageContainer title={t("title")} subtitle={t("subtitle")}>
        <HomeBody
          loading={isLoading}
          error={error}
          repoName={target?.full_name}
          onRetry={() => refetch()}
          onOpenRepo={() => targetHref && router.push(targetHref)}
          onAddRepo={() => router.push("/onboarding")}
        />
      </PageContainer>
    </AppShell>
  );
}

interface HomeBodyProps {
  loading: boolean;
  /** The load error, or null when the repositories loaded. */
  error: unknown;
  /** Name of the repo the user is being sent to; undefined when there is none. */
  repoName: string | undefined;
  onRetry: () => void;
  onOpenRepo: () => void;
  onAddRepo: () => void;
}

function HomeBody({ loading, error, repoName, onRetry, onOpenRepo, onAddRepo }: HomeBodyProps) {
  const t = useTranslations("home");

  if (loading) {
    return (
      <div style={s.loading}>
        <Skeleton height={20} width={240} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t("errorTitle")}
        body={error instanceof ApiError ? error.message : t("errorBody")}
        onRetry={onRetry}
      />
    );
  }

  if (!repoName) {
    return (
      <EmptyState
        icon="GitBranch"
        title={t("emptyTitle")}
        body={t("emptyBody")}
        cta={t("emptyCta")}
        onCta={onAddRepo}
      />
    );
  }

  return (
    <div>
      <p style={s.redirecting}>{t("redirecting")}</p>
      <Button kind="primary" onClick={onOpenRepo}>
        {t("openRepo", { name: repoName })}
      </Button>
    </div>
  );
}
