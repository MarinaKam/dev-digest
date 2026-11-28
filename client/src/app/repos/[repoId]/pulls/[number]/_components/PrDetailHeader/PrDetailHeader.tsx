"use client";

import { useTranslations } from "next-intl";
import { Icon, Avatar, Badge, Button, Tabs } from "@devdigest/ui";
import type { PrDetail } from "@devdigest/shared";
import { RunReviewDropdown } from "../RunReviewDropdown";
import { OPEN_STATUS_COLOR, STATUS_COLOR, TABS } from "./constants";
import { s } from "./styles";

interface PrDetailHeaderProps {
  pr: PrDetail;
  prId: string;
  tab: string;
  findingsCount: number;
  /** github.com PR URL; null when the repo's full_name isn't known yet. */
  githubUrl?: string | null;
  onSetTab: (tab: string) => void;
  /** Fired the moment a review run is kicked off. */
  onRunStart: () => void;
}

export function PrDetailHeader({
  pr,
  prId,
  tab,
  findingsCount,
  githubUrl,
  onSetTab,
  onRunStart,
}: PrDetailHeaderProps) {
  const t = useTranslations("prReview");
  const settled = pr.status === "merged" || pr.status === "closed";
  const tabCounts: Record<string, number | undefined> = {
    findings: findingsCount || undefined,
    diff: pr.files_count,
  };

  return (
    <div style={s.root}>
      <div style={s.titleRow}>
        <div style={s.titleCol}>
          <h1 style={s.h1}>
            <span className="mono" style={s.prNumber}>
              #{pr.number}
            </span>
            {pr.title}
          </h1>
          <div style={s.meta}>
            <span style={s.authorChip}>
              <Avatar name={pr.author} size={17} />
              {pr.author}
            </span>
            <span style={s.branchChip}>
              <Icon.GitBranch size={13} style={s.branchIcon} />
              <span className="mono" style={s.branchMono}>
                {pr.branch}
              </span>
              <Icon.ArrowRight size={11} />
              <span className="mono" style={s.branchMono}>
                {pr.base}
              </span>
            </span>
            <span className="mono tnum">
              <span style={s.addText}>+{pr.additions}</span>{" "}
              <span style={s.delText}>−{pr.deletions}</span>
            </span>
            <Badge dot bg="transparent" color={STATUS_COLOR[pr.status] ?? OPEN_STATUS_COLOR}>
              {pr.status}
            </Badge>
          </div>
        </div>
        <div style={s.actions}>
          <Button
            kind="ghost"
            size="sm"
            icon="ExternalLink"
            disabled={!githubUrl}
            onClick={() => githubUrl && window.open(githubUrl, "_blank", "noopener,noreferrer")}
          >
            {t("detail.viewOnGitHub")}
          </Button>
          <RunReviewDropdown prId={prId} warnMerged={settled} onRunStart={onRunStart} />
        </div>
      </div>
      {settled && (
        <div style={s.staleBanner}>
          <Icon.AlertTriangle size={13} style={s.warnIcon} />
          <span>{t("detail.closedBanner", { status: pr.status })}</span>
        </div>
      )}
      <Tabs
        value={tab}
        onChange={onSetTab}
        pad="0"
        tabs={TABS.map(({ key, icon }) => ({
          key,
          icon,
          label: t(`detail.tabs.${key}`),
          count: tabCounts[key],
        }))}
      />
    </div>
  );
}
