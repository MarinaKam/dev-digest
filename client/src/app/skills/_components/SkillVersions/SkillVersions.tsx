"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillVersions, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { diffPrefix, hasChanges, lineDiff } from "./helpers";
import { s } from "./styles";

interface SkillVersionsProps {
  skill: Skill;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
}

/** Versions tab: every snapshot of the body, a diff against the current body, restore. */
export function SkillVersions({ skill }: SkillVersionsProps) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const update = useUpdateSkill();
  const [diffOf, setDiffOf] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton height={120} />;
  if (isError || !data) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;

  const versions = [...data].sort((a, b) => b.version - a.version);

  const restore = (version: number, body: string) =>
    update.mutate(
      { id: skill.id, patch: { body, version_note: t("versions.restoredNote", { version }) } },
      { onSuccess: (saved) => toast.success(t("versions.restoredToast", { version: saved.version })) },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("versions.title")}</h2>
        <Badge color="var(--text-secondary)">{t("versions.count", { count: versions.length })}</Badge>
      </div>
      <p style={s.explain}>{t("versions.explain")}</p>

      <div style={s.list}>
        {versions.map((version) => {
          const current = version.version === skill.version;
          const diff = diffOf === version.version ? lineDiff(version.body, skill.body) : null;
          return (
            <Card key={version.version}>
              <div style={s.row}>
                <span className="mono" style={s.version}>
                  {t("versions.version", { version: version.version })}
                </span>
                <div style={s.meta}>
                  {version.note && <span style={s.noteText}>{version.note}</span>}
                  <span style={s.date}>{formatDate(version.created_at)}</span>
                </div>
                {current && <Badge color="var(--ok)">{t("versions.current")}</Badge>}
                {!current && (
                  <>
                    <Button
                      kind="secondary"
                      size="sm"
                      data-testid={`diff-v${version.version}`}
                      onClick={() => setDiffOf(diff ? null : version.version)}
                    >
                      {diff ? t("versions.hideDiff") : t("versions.diff")}
                    </Button>
                    <Button
                      kind="secondary"
                      size="sm"
                      data-testid={`restore-v${version.version}`}
                      onClick={() => restore(version.version, version.body)}
                      // Restoring the current body would save nothing new (spec rule 5b).
                      disabled={update.isPending || version.body === skill.body}
                    >
                      {t("versions.restore")}
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
            </Card>
          );
        })}
      </div>
    </div>
  );
}
