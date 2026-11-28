/* HomeView — / . Sends the user to the first repo's PR list, or offers to add
   a repository when there is none. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-shell";
import { useRepos } from "@/lib/hooks/repos";
import { s } from "./styles";

export function HomeView() {
  const t = useTranslations("home");
  const router = useRouter();
  const { data: repos, isLoading } = useRepos();
  const firstRepo = repos?.[0];
  const firstRepoHref = firstRepo ? `/repos/${firstRepo.id}/pulls` : null;

  // Navigation is the side effect here: the start page has no content of its
  // own once a repository exists.
  React.useEffect(() => {
    if (firstRepoHref) router.replace(firstRepoHref);
  }, [firstRepoHref, router]);

  return (
    <AppShell crumb={[{ label: t("breadcrumb") }]}>
      <PageContainer title={t("title")} subtitle={t("subtitle")}>
        <HomeBody
          loading={isLoading}
          repoName={firstRepo?.full_name}
          onOpenRepo={() => firstRepoHref && router.push(firstRepoHref)}
          onAddRepo={() => router.push("/onboarding")}
        />
      </PageContainer>
    </AppShell>
  );
}

interface HomeBodyProps {
  loading: boolean;
  /** Name of the repo the user is being sent to; undefined when there is none. */
  repoName: string | undefined;
  onOpenRepo: () => void;
  onAddRepo: () => void;
}

function HomeBody({ loading, repoName, onOpenRepo, onAddRepo }: HomeBodyProps) {
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

  // A failed load reads the same as "no repositories": the way out is the same.
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
