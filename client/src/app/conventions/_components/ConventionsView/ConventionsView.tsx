/* ConventionsView — /conventions (spec 004, design `ScreenConventions`).
   Works on the active repo of the sidebar (no repo id in the URL, as in the
   design): runs the extractor, lists the candidates with their evidence, and
   turns the accepted ones into a skill. */
"use client";

import React from "react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type { ConventionStatus, Skill } from "@devdigest/shared";
import { Button, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { isRunInFlight, useConventions, useExtractConventions, useUpdateConvention } from "@/lib/hooks/conventions";
import { useActiveRepo } from "@/lib/repo-context";
import { evidenceUrl } from "../../helpers";
import { ConventionCard } from "../ConventionCard";
import { CreateConventionsSkillModal } from "../CreateConventionsSkillModal";
import { s } from "./styles";

export function ConventionsView() {
  const t = useTranslations("conventions");
  const format = useFormatter();
  // "last scan 5 minutes ago" and "started 20 seconds ago" move on while the page is open.
  const now = useNow({ updateInterval: 5_000 });
  const { activeRepo, reposLoaded } = useActiveRepo();
  const repoId = activeRepo?.id ?? "";
  const { data, isLoading, error, refetch } = useConventions(activeRepo?.id);
  const extract = useExtractConventions();
  const update = useUpdateConvention();
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState<Skill | null>(null);

  const crumb = [{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }];

  // No repository yet (or the list is still loading): nothing to scan.
  if (!activeRepo) {
    return (
      <AppShell crumb={crumb}>
        <div style={s.page}>
          {reposLoaded ? (
            <EmptyState icon="GitBranch" title={t("page.noRepo.title")} body={t("page.noRepo.body")} />
          ) : (
            <div style={s.loading} data-testid="conventions-loading">
              <Skeleton height={120} />
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  const repoName = activeRepo.name;
  const fullName = activeRepo.full_name;
  const branch = activeRepo.default_branch;

  const candidates = data?.candidates ?? [];
  const lastScan = data?.last_scan ?? null;
  const accepted = candidates.filter((c) => c.accepted);
  const pending = candidates.filter((c) => c.status === "pending");
  // A rejected candidate stays on the page, marked, but does not count.
  const decidable = candidates.filter((c) => c.status !== "rejected");
  // A run in flight, started here or in another tab (the server reports it; the list polls).
  const running = data?.running ?? null;
  const scanning = extract.isPending || running !== null;
  // "Already running" is not a failure: the run in flight is shown instead.
  const failure = extract.error && !isRunInFlight(extract.error) ? extract.error : null;
  const busyId = update.isPending ? update.variables?.id : undefined;

  const run = () => {
    setCreated(null);
    extract.mutate({ repoId });
  };
  const setStatus = (id: string, status: ConventionStatus) => update.mutate({ repoId, id, patch: { status } });
  const setAll = (from: ConventionStatus, to: ConventionStatus) => {
    for (const c of candidates.filter((x) => x.status === from)) setStatus(c.id, to);
  };

  /** "5 minutes ago", never in the future (the database clock may run a little ahead). */
  const ago = (iso: string) => format.relativeTime(new Date(Math.min(Date.parse(iso), now.getTime())), now);

  const subtitle = lastScan
    ? t("page.lastScan", {
        files: lastScan.files_sampled,
        when: ago(lastScan.at),
        model: lastScan.model,
      })
    : t("page.subtitle");

  const header = (
    <div style={s.header}>
      <div style={s.headerText}>
        <h1 style={s.title}>
          {t("page.headingPrefix")}
          <span className="mono" style={s.repo}>
            {repoName}
          </span>
        </h1>
        <p style={s.subtitle}>{subtitle}</p>
      </div>
      {lastScan && (
        <div style={s.headerActions}>
          {/* A disabled button gets no hover events: the wrapper carries the tooltip. */}
          <span title={scanning ? t("page.runningHint") : undefined}>
            <Button kind="secondary" size="sm" icon="RefreshCw" loading={scanning} disabled={scanning} onClick={run}>
              {scanning ? t("page.scanning") : t("page.rescan")}
            </Button>
          </span>
        </div>
      )}
    </div>
  );

  const notices = (
    <>
      {scanning && (
        <div role="status" style={s.notice("info")}>
          <Icon.RefreshCw size={14} style={s.spin} />
          <span>
            <strong>{t("page.runningTitle")}</strong>
            {running && ` · ${t("page.runningStarted", { when: ago(running.started_at) })}`}
            {running?.files_sampled != null && ` · ${t("page.runningFiles", { files: running.files_sampled })}`}
            {running?.model && ` · ${running.model}`}
          </span>
        </div>
      )}
      {failure && (
        <div role="alert" style={s.notice("error")}>
          <Icon.AlertTriangle size={14} />
          <span>
            {t("page.extractionFailed")}: {failure.message}
          </span>
        </div>
      )}
      {created && (
        <div role="status" style={s.notice("ok")}>
          <Icon.Check size={14} />
          <span>{t("modal.created", { name: created.name })}</span>
          <Link href={`/skills?skill=${created.id}`} style={s.noticeLink}>
            {t("modal.openSkill")}
          </Link>
        </div>
      )}
      {lastScan && !failure && !scanning && (
        <div style={s.notice("info")}>
          <Icon.ListChecks size={14} />
          <span>
            {lastScan.kept === 0
              ? t("page.nothingFound")
              : t("page.scanResult", { proposed: lastScan.proposed, kept: lastScan.kept, added: lastScan.added })}
          </span>
        </div>
      )}
    </>
  );

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div style={s.loading} data-testid="conventions-loading">
        <Skeleton height={120} />
        <Skeleton height={120} />
      </div>
    );
  } else if (error) {
    content = <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />;
  } else if (!lastScan && candidates.length === 0) {
    content = (
      <EmptyState
        icon="ListChecks"
        title={t("page.empty.title")}
        body={t("page.empty.body")}
        cta={scanning ? t("page.scanning") : t("page.empty.cta")}
        onCta={run}
        ctaLoading={scanning}
      />
    );
  } else {
    content = (
      <>
        {candidates.length > 0 && (
          <div style={s.toolbar}>
            {pending.length > 0 ? (
              <Button kind="ghost" size="sm" icon="Check" onClick={() => setAll("pending", "accepted")}>
                {t("page.acceptAll")}
              </Button>
            ) : (
              <Button kind="ghost" size="sm" icon="X" onClick={() => setAll("accepted", "pending")}>
                {t("page.deselectAll")}
              </Button>
            )}
            <span style={s.count}>{t("page.acceptedCount", { accepted: accepted.length, total: decidable.length })}</span>
            <div style={s.toolbarEnd}>
              <Button
                kind="primary"
                size="sm"
                icon="Sparkles"
                disabled={accepted.length === 0}
                onClick={() => setCreating(true)}
              >
                {t("page.createSkill")}
              </Button>
            </div>
          </div>
        )}
        {candidates.map((c) => (
          <ConventionCard
            key={c.id}
            convention={c}
            githubUrl={evidenceUrl(fullName, branch, c)}
            busy={busyId === c.id}
            onStatus={(status) => setStatus(c.id, status)}
            onRule={(rule) => update.mutate({ repoId, id: c.id, patch: { rule } })}
          />
        ))}
      </>
    );
  }

  return (
    <AppShell crumb={crumb}>
      {creating && accepted.length > 0 && (
        <CreateConventionsSkillModal
          repoId={repoId}
          repoName={repoName}
          conventions={accepted}
          onClose={() => setCreating(false)}
          onCreated={setCreated}
        />
      )}
      <div style={s.page}>
        {header}
        {notices}
        {content}
      </div>
    </AppShell>
  );
}
