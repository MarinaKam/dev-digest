/* ReviewRunAccordion — one collapsible review RUN (a single agent's pass over
   the PR). Header shows agent + verdict + counts + score + when it ran; the
   body holds that run's VerdictBanner summary and its own FindingsPanel. A PR
   can have many runs (different agents / re-runs over time) — each is separate
   and collapsible so older runs don't bury the latest. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge } from "@devdigest/ui";
import type { ReviewRecord, RunSummary, Verdict } from "@devdigest/shared";
import { formatDateTime } from "@/lib/format-date";
import { useDeleteReview } from "@/lib/hooks/reviews";
import { completedRunCost } from "../../../helpers";
import { FindingsPanel } from "../FindingsPanel";
import { VerdictBanner } from "../VerdictBanner";
import { NO_VERDICT_COLOR, VERDICT_COLOR } from "./constants";
import { chevronFor, deleteButtonFor, s } from "./styles";

/** A request to open one run's accordion and scroll to it. `n` changes on every
    request, so asking for the same run twice scrolls twice. */
export interface ScrollTarget {
  runId: string;
  n: number;
}

interface ReviewRunAccordionProps {
  review: ReviewRecord;
  /** The agent run that produced this review (its cost + tokens), if loaded. */
  run?: RunSummary | null;
  prId: string;
  defaultOpen?: boolean;
  repoFullName?: string | null;
  headSha?: string | null;
  /** When it names this review's run, the accordion opens and scrolls into view
      (driven from the Timeline: clicking an agent name navigates here). */
  scrollTarget?: ScrollTarget | null;
}

export function ReviewRunAccordion({
  review,
  run = null,
  prId,
  defaultOpen = false,
  repoFullName,
  headSha,
  scrollTarget = null,
}: ReviewRunAccordionProps) {
  const t = useTranslations("prReview");
  const [open, setOpen] = React.useState(defaultOpen);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const panelId = React.useId();
  const del = useDeleteReview(prId);

  React.useEffect(() => {
    if (!scrollTarget || !review.run_id || scrollTarget.runId !== review.run_id) return;
    setOpen(true);
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollTarget, review.run_id]);

  const findings = review.findings;
  const blockers = findings.filter((f) => f.severity === "CRITICAL" && !f.dismissed_at).length;
  const agentName = review.agent_name ?? t("timeline.agentFallback");
  const verdictColor = (review.verdict && VERDICT_COLOR[review.verdict]) || NO_VERDICT_COLOR;

  const handleDelete = () => {
    if (window.confirm(t("accordion.deleteConfirm", { agent: agentName }))) del.mutate(review.id);
  };

  return (
    <div
      ref={rootRef}
      id={review.run_id ? `review-run-${review.run_id}` : undefined}
      style={s.root}
    >
      <div style={s.header}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          style={s.toggle}
        >
          <Icon.Cpu size={15} style={s.agentIcon} />
          <span style={s.agentName}>{agentName}</span>
          {review.verdict && (
            <Badge color={verdictColor} bg="transparent">
              {review.verdict.replace("_", " ")}
            </Badge>
          )}
          <span style={s.counts}>
            {t("accordion.findings", { count: findings.length })}
            {blockers > 0 ? t("accordion.blockers", { count: blockers }) : ""}
          </span>
          <span style={s.spacer} />
          {review.score != null && (
            <Badge mono color="var(--text-secondary)">
              {review.score}
            </Badge>
          )}
          <span className="mono" style={s.when}>
            {formatDateTime(review.created_at)}
          </span>
          <Icon.ChevronDown size={16} style={chevronFor(open)} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={del.isPending}
          title={t("accordion.deleteTitle")}
          aria-label={t("accordion.deleteTitle")}
          style={deleteButtonFor(del.isPending)}
        >
          <Icon.Trash size={14} style={del.isPending ? s.spinning : undefined} />
        </button>
      </div>

      {open && (
        <div id={panelId} style={s.body}>
          {review.verdict && (
            <div style={s.verdict}>
              <VerdictBanner
                verdict={review.verdict as Verdict}
                summary={review.summary}
                score={review.score}
                findingsCount={findings.length}
                blockers={blockers}
                agentName={review.agent_name}
                costUsd={completedRunCost(run)}
                tokensIn={run?.tokens_in}
                tokensOut={run?.tokens_out}
              />
            </div>
          )}
          <FindingsPanel
            findings={findings}
            prId={prId}
            repoFullName={repoFullName}
            headSha={headSha}
          />
        </div>
      )}
    </div>
  );
}
