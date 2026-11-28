"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, Markdown } from "@devdigest/ui";
import type { SkillImportPreview } from "@devdigest/shared";
import { useCreateSkill } from "@/lib/hooks/skills";
import { SkillFields } from "../../../SkillFields";
import { hasErrors, validateSkillForm, type SkillFormValues } from "../../../helpers";
import { s } from "../../styles";

interface ImportReviewProps {
  preview: SkillImportPreview;
  onClose: () => void;
  /** Called with the id of the saved skill. */
  onCreated: (id: string) => void;
}

/** The parsed draft, the import report and the Save skill button. Saves nothing until Save skill. */
export function ImportReview({ preview, onClose, onCreated }: ImportReviewProps) {
  const t = useTranslations("skills");
  const create = useCreateSkill();
  const [form, setForm] = React.useState<SkillFormValues>(() => ({
    name: preview.draft.name,
    description: preview.draft.description,
    type: preview.draft.type,
    body: preview.draft.body,
    enabled: true,
  }));
  const invalid = hasErrors(validateSkillForm(form));

  const save = () =>
    create.mutate(
      {
        name: form.name,
        description: form.description,
        type: form.type,
        body: form.body,
        source: "imported_file",
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
      <div style={s.muted}>{t("import.coreFile", { path: preview.core_path })}</div>

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
          <Markdown>{form.body}</Markdown>
        </Card>
      </section>

      {create.error && (
        <div role="alert" style={s.error}>
          {t("import.saveFailed", { message: create.error.message })}
        </div>
      )}
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
