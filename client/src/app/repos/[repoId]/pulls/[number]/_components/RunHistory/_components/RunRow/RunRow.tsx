"use client";

import { useTranslations } from "next-intl";
import { Badge, CircularScore, Icon } from "@devdigest/ui";
import type { FindingRecord, RunSummary } from "@devdigest/shared";
import { formatTime } from "@/lib/format-date";
import { FindingsPopover } from "../../../../../_components/FindingsPopover";
import { RunCostBadge } from "../../../../../_components/RunCostBadge";
import { completedRunCost, countBySeverity, visibleFindings } from "../../../../../helpers";
import { outcomeOf } from "../../helpers";
import { agentButtonFor, s } from "../../styles";

interface RunRowProps {
  run: RunSummary;
  /** The run's findings when its review is loaded; empty shows the plain count. */
  findings: FindingRecord[];
  /** owner/repo + head sha — used to link a finding's file:line to GitHub. */
  repoFullName?: string | null;
  headSha?: string | null;
  onOpenTrace: (runId: string) => void;
  onGoToReview?: (runId: string) => void;
  onDelete?: (runId: string) => void;
}

/** One agent run in the PR timeline: outcome, agent, findings, cost, actions. */
export function RunRow({
  run,
  findings,
  repoFullName,
  headSha,
  onOpenTrace,
  onGoToReview,
  onDelete,
}: RunRowProps) {
  const t = useTranslations("prReview");
  const outcome = outcomeOf(run);
  const settled = run.status === "done";
  const blockers = run.blockers ?? 0;

  return (
    <div style={s.runRow}>
      <Badge color={outcome.color} bg={outcome.bg} icon={outcome.icon}>
        {t(`runStatus.${outcome.key}`)}
      </Badge>
      {settled && run.score != null && <CircularScore score={run.score} size={30} stroke={3} />}
      <div style={s.runMain}>
        <div style={s.runTitle}>
          <button
            type="button"
            onClick={() => onGoToReview?.(run.run_id)}
            title={t("timeline.goToReview")}
            style={agentButtonFor(!!onGoToReview)}
          >
            {run.agent_name ?? t("timeline.agentFallback")}
          </button>{" "}
          <span className="mono" style={s.runModel}>
            {run.provider}/{run.model}
          </span>
        </div>
        {run.status === "failed" && run.error && (
          <div style={s.runError} title={run.error}>
            {run.error}
          </div>
        )}
        {settled && (
          <div style={s.settledLine}>
            {findings.length > 0 ? (
              <FindingsPopover
                counts={countBySeverity(findings)}
                findings={visibleFindings(findings, false)}
                heading={t("timeline.findingsInRun", { count: findings.length })}
                repoFullName={repoFullName}
                headSha={headSha}
                onSelect={onGoToReview ? () => onGoToReview(run.run_id) : undefined}
              />
            ) : (
              t("runStatus.findings", { count: run.findings_count ?? 0 })
            )}
            {blockers > 0 ? t("runStatus.blockers", { count: blockers }) : ""}
          </div>
        )}
      </div>
      <div style={s.runAside}>
        {run.ran_at && <span>{formatTime(run.ran_at)}</span>}
        <RunCostBadge
          variant="full"
          costUsd={completedRunCost(run)}
          tokensIn={run.tokens_in}
          tokensOut={run.tokens_out}
        />
      </div>
      <button
        type="button"
        title={t("timeline.openTrace")}
        aria-label={t("timeline.openTrace")}
        onClick={() => onOpenTrace(run.run_id)}
        style={s.traceBtn}
      >
        <Icon.FileText size={13} />
      </button>
      {onDelete && run.status !== "running" && (
        <button
          type="button"
          aria-label={t("timeline.deleteRun")}
          title={t("timeline.deleteRun")}
          onClick={() => onDelete(run.run_id)}
          style={s.deleteBtn}
        >
          <Icon.Trash size={13} />
        </button>
      )}
    </div>
  );
}
