"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { ConventionCandidate, ConventionStatus } from "@devdigest/shared";
import { Button, Icon, ProgressBar, TextInput } from "@devdigest/ui";
import { useToast } from "@/lib/toast";
import { CONVENTION_RULE_MAX, HIGH_CONFIDENCE } from "../../constants";
import { evidenceLabel } from "../../helpers";
import { s } from "./styles";

interface ConventionCardProps {
  convention: ConventionCandidate;
  /** The evidence on GitHub (file at the cited lines). */
  githubUrl: string;
  /** A request for this card is in flight: its buttons wait. */
  busy?: boolean;
  onStatus: (status: ConventionStatus) => void;
  onRule: (rule: string) => void;
}

/**
 * One candidate (design: `ConventionCard`): the rule (click to edit), the
 * evidence file and snippet, the confidence, and Accept / Reject.
 */
export function ConventionCard({ convention, githubUrl, busy, onStatus, onRule }: ConventionCardProps) {
  const t = useTranslations("conventions");
  const toast = useToast();
  const [draft, setDraft] = React.useState<string | null>(null);
  const accepted = convention.status === "accepted";
  const rejected = convention.status === "rejected";
  const percent = Math.round(convention.confidence * 100);
  const label = evidenceLabel(convention);
  const trimmed = draft?.trim() ?? "";
  const canSave = trimmed.length > 0 && trimmed.length <= CONVENTION_RULE_MAX && trimmed !== convention.rule;

  const save = () => {
    if (canSave) onRule(trimmed);
    setDraft(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(convention.evidence_snippet);
      toast.success(t("card.copied"));
    } catch {
      /* Clipboard refused (insecure context): nothing to undo. */
    }
  };

  return (
    <article style={s.card(convention.status)} aria-label={convention.rule}>
      <div style={s.row}>
        <div style={s.main}>
          {draft === null ? (
            <button type="button" style={s.rule} title={t("card.editRule")} onClick={() => setDraft(convention.rule)}>
              {convention.rule}
            </button>
          ) : (
            <div>
              <TextInput
                aria-label={t("card.ruleLabel")}
                value={draft}
                onChange={setDraft}
                maxLength={CONVENTION_RULE_MAX}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setDraft(null);
                }}
              />
              <div style={s.editActions}>
                <Button kind="primary" size="sm" onClick={save} disabled={!canSave}>
                  {t("card.save")}
                </Button>
                <Button kind="ghost" size="sm" onClick={() => setDraft(null)}>
                  {t("card.cancel")}
                </Button>
              </div>
            </div>
          )}

          <div style={s.evidence}>
            <div style={s.evidenceHeader}>
              <span className="mono" style={s.path}>
                {label}
              </span>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={s.githubLink}
                aria-label={t("card.openOnGithub", { path: label })}
              >
                <Icon.ExternalLink size={11} />
                {t("card.github")}
              </a>
              <button type="button" style={s.copy} onClick={copy} aria-label={t("card.copySnippet")}>
                <Icon.Copy size={12} />
              </button>
            </div>
            <pre className="mono" style={s.snippet}>
              {convention.evidence_snippet}
            </pre>
          </div>

          <div style={s.confidence}>
            <span style={s.confidenceLabel}>{t("card.confidence")}</span>
            <div style={s.confidenceBar}>
              <ProgressBar
                value={percent}
                height={5}
                color={convention.confidence >= HIGH_CONFIDENCE ? "var(--ok)" : "var(--warn)"}
              />
            </div>
            <span className="mono tnum" style={s.confidenceValue}>
              {percent}%
            </span>
          </div>
        </div>

        <div style={s.actions}>
          {/* Accepted / Rejected are marks that undo on click (back to undecided). */}
          {accepted ? (
            <Button
              kind="primary"
              size="sm"
              icon="Check"
              full
              disabled={busy}
              title={t("card.undo")}
              onClick={() => onStatus("pending")}
            >
              {t("card.accepted")}
            </Button>
          ) : (
            <Button kind="secondary" size="sm" icon="Plus" full disabled={busy} onClick={() => onStatus("accepted")}>
              {t("card.accept")}
            </Button>
          )}
          {rejected ? (
            <Button
              kind="danger"
              size="sm"
              icon="X"
              full
              disabled={busy}
              title={t("card.undo")}
              onClick={() => onStatus("pending")}
            >
              {t("card.rejected")}
            </Button>
          ) : (
            <Button kind="ghost" size="sm" icon="X" full disabled={busy} onClick={() => onStatus("rejected")}>
              {t("card.reject")}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
