"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card } from "@devdigest/ui";
import type { SkillImportPreview } from "@devdigest/shared";
import { useCreateSkill } from "@/lib/hooks/skills";
import { MarkdownBody } from "../../../MarkdownBody";
import { SkillFields } from "../../../SkillFields";
import { SKILL_VERSION_NOTE_MAX } from "../../../constants";
import { hasErrors, validateSkillForm, type SkillFormValues } from "../../../helpers";
import { s } from "../../styles";

interface ImportReviewProps {
  preview: SkillImportPreview;
  /** The URL the draft was downloaded from; absent for a file import. */
  origin?: string;
  onClose: () => void;
  /** Called with the id of the saved skill. */
  onCreated: (id: string) => void;
}

/** The parsed draft, the import report and the Save skill button. Saves nothing until Save skill. */
export function ImportReview({ preview, origin, onClose, onCreated }: ImportReviewProps) {
  const t = useTranslations("skills");
  const create = useCreateSkill();
  const [form, setForm] = React.useState<SkillFormValues>(() => ({
    name: preview.draft.name,
    description: preview.draft.description,
    type: preview.draft.type,
    body: preview.draft.body,
    // A body that tries to take over the reviewer is saved off (spec 004).
    enabled: preview.injection_flags.length === 0,
  }));
  const invalid = hasErrors(validateSkillForm(form));

  const save = () =>
    create.mutate(
      {
        name: form.name,
        description: form.description,
        type: form.type,
        body: form.body,
        enabled: form.enabled,
        source: preview.draft.source,
        version_note: fitVersionNote(
          origin
            ? t("import.versionNoteUrl", { url: origin })
            : t("import.versionNote", { file: preview.core_path }),
        ),
      },
      {
        onSuccess: (skill) => {
          onCreated(skill.id);
          onClose();
        },
      },
    );

  return (
    <>
      <div role="note" style={s.trust}>
        {t("import.trustWarning")}
      </div>
      <div style={s.muted}>{t("import.coreFile", { path: origin ?? preview.core_path })}</div>

      {preview.injection_flags.length > 0 && (
        <section role="alert" style={s.injection}>
          <div style={s.injectionTitle}>{t("import.injectionTitle")}</div>
          <div>{t("import.injectionBody")}</div>
          <ul style={s.list}>
            {preview.injection_flags.map((flag) => (
              <li key={flag} className="mono" style={s.flag}>
                {flag}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.warnings.length > 0 && (
        <section style={s.section}>
          <div style={s.sectionTitle}>{t("import.warningsTitle")}</div>
          <ul style={s.list}>
            {preview.warnings.map((warning) => (
              <li key={warning} style={s.item}>
                {warning}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.skipped_files.length > 0 && (
        <section style={s.section}>
          <div style={s.sectionTitle}>{t("import.skippedTitle")}</div>
          <ul style={s.list}>
            {preview.skipped_files.map((file) => (
              <li key={file.path} style={s.item}>
                <span className="mono" style={s.path}>
                  {file.path}
                </span>
                <Badge color="var(--warn)">{t("import.skipped")}</Badge>
                <span style={s.muted}>{t(`import.reason.${file.reason}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.ignored_keys.length > 0 && (
        <div style={s.muted}>{t("import.ignoredKeys", { keys: preview.ignored_keys.join(", ") })}</div>
      )}

      {preview.unreadable_keys.length > 0 && (
        <section style={s.section}>
          <div style={s.sectionTitle}>{t("import.unreadableTitle")}</div>
          <ul style={s.list}>
            {preview.unreadable_keys.map((item) => (
              <li key={`${item.key}:${item.line}`} style={s.item}>
                {t("import.unreadable", { key: item.key, line: item.line, reason: item.reason })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SkillFields values={form} onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))} />

      <section style={s.section}>
        <div style={s.sectionTitle}>{t("import.previewTitle")}</div>
        <Card style={s.rendered}>
          <MarkdownBody>{form.body}</MarkdownBody>
        </Card>
      </section>

      {/* A failed save is reported by the global mutation error toast. */}
      <div style={s.actions}>
        <Button kind="secondary" onClick={onClose}>
          {t("import.cancel")}
        </Button>
        <Button kind="primary" icon="Check" onClick={save} disabled={invalid || create.isPending}>
          {create.isPending ? t("import.saving") : t("import.save")}
        </Button>
      </div>
    </>
  );
}

/** The server rejects a note over SKILL_VERSION_NOTE_MAX; a deep archive path can exceed it. */
function fitVersionNote(note: string): string {
  return note.length <= SKILL_VERSION_NOTE_MAX ? note : `${note.slice(0, SKILL_VERSION_NOTE_MAX - 1)}…`;
}
