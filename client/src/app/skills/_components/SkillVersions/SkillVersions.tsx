"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillVersions, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { diffPrefix, hasChanges, lineDiff, viewerTimeZone } from "./helpers";
import { s } from "./styles";

interface SkillVersionsProps {
  skill: Skill;
}

/** Versions tab: every snapshot of the body, a diff against the current body, restore. */
export function SkillVersions({ skill }: SkillVersionsProps) {
  const t = useTranslations("skills");
  const format = useFormatter();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const update = useUpdateSkill();
  const [diffOf, setDiffOf] = React.useState<number | null>(null);
  const [restoringOf, setRestoringOf] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton height={120} />;
  if (isError || !data) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;

  const versions = [...data].sort((a, b) => b.version - a.version);
  const timeZone = viewerTimeZone();

  const restore = (version: number, body: string) => {
    setRestoringOf(version);
    update.mutate(
      { id: skill.id, patch: { body, version_note: t("versions.restoredNote", { version }) } },
      { onSuccess: (saved) => toast.success(t("versions.restoredToast", { version: saved.version })) },
    );
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("versions.title")}</h2>
        <Badge color="var(--text-secondary)">{t("versions.count", { count: versions.length })}</Badge>
      </div>
      <p style={s.explain}>{t("versions.explain")}</p>

      <ul style={s.list}>
        {versions.map((version) => {
          const current = version.version === skill.version;
          const diff = diffOf === version.version ? lineDiff(version.body, skill.body) : null;
          const restoring = update.isPending && restoringOf === version.version;
          return (
            <li key={version.version} style={s.item}>
              <div style={s.row(current)}>
                <span className="mono" style={s.chip(current)}>
                  {t("versions.version", { version: version.version })}
                </span>
                <div style={s.meta}>
                  {version.note && <div style={s.noteText}>{version.note}</div>}
                  <div style={s.date}>
                    {format.dateTime(new Date(version.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone,
                    })}
                  </div>
                </div>
                {current ? (
                  <Badge color="var(--ok)" bg="var(--ok-bg)" dot>
                    {t("versions.current")}
                  </Badge>
                ) : (
                  <>
                    <Button
                      kind="ghost"
                      size="sm"
                      icon="Eye"
                      aria-expanded={diff !== null}
                      onClick={() => setDiffOf(diff ? null : version.version)}
                    >
                      {diff ? t("versions.hideDiff") : t("versions.diff")}
                    </Button>
                    <Button
                      kind="secondary"
                      size="sm"
                      icon="History"
                      onClick={() => restore(version.version, version.body)}
                      // Restoring the current body would save nothing new (spec rule 5b).
                      disabled={update.isPending || version.body === skill.body}
                    >
                      {restoring ? t("versions.restoring") : t("versions.restore")}
                    </Button>
                  </>
                )}
              </div>
              {diff && (
                <>
                  <pre className="mono" style={s.diff}>
                    {diff.map((line, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no id and the list is static
                      <code key={i} style={s.diffLine(line.kind)}>
                        {diffPrefix(line.kind)}
                        {line.text}
                      </code>
                    ))}
                  </pre>
                  {!hasChanges(diff) && <div style={s.note}>{t("versions.diffEmpty")}</div>}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
