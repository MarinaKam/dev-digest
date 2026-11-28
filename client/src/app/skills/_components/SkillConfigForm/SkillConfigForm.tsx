"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, TextInput, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SkillFields } from "../SkillFields";
import { changedFields, hasErrors, toFormValues, validateSkillForm, type SkillFormValues } from "../helpers";
import { SKILL_VERSION_NOTE_MAX } from "../constants";
import { s } from "./styles";

interface SkillConfigFormProps {
  /** The form starts from this skill. Render with `key={skill.id}` so that
      opening another skill starts a fresh form. */
  skill: Skill;
  /** Called after the skill was deleted. */
  onDeleted: (id: string) => void;
}

/** Config tab: edit the skill's fields, save a new version, delete the skill. */
export function SkillConfigForm({ skill, onDeleted }: SkillConfigFormProps) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const remove = useDeleteSkill();
  const [form, setForm] = React.useState<SkillFormValues>(() => toFormValues(skill));
  const [versionNote, setVersionNote] = React.useState("");

  // Enabled is saved at once by its toggle (like the card's), never with the
  // form: a form copy could switch back on a skill turned off on its card.
  const patch = changedFields(skill, { ...form, enabled: skill.enabled });
  const dirty = Object.keys(patch).length > 0;
  const bodyChanged = patch.body !== undefined;
  const invalid = hasErrors(validateSkillForm(form));

  const change = (next: Partial<SkillFormValues>) => setForm((prev) => ({ ...prev, ...next }));

  const save = () =>
    update.mutate(
      { id: skill.id, patch: bodyChanged && versionNote.trim() ? { ...patch, version_note: versionNote.trim() } : patch },
      // Failures (409 name taken, 422) reach the user through the global mutation error toast.
      {
        onSuccess: (data) => {
          setVersionNote("");
          toast.success(t("config.savedToast", { version: data.version }));
        },
      },
    );

  const handleDelete = () => {
    const message = t("config.deleteConfirm", { name: skill.name, count: skill.used_by.length });
    if (!window.confirm(message)) return;
    remove.mutate(skill.id, {
      onSuccess: () => {
        toast.success(t("config.deletedToast"));
        onDeleted(skill.id);
      },
    });
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <Badge color="var(--text-secondary)" mono>
          {t("editor.version", { version: skill.version })}
        </Badge>
        <div style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle
            on={skill.enabled}
            onChange={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
            size={16}
          />
        </div>
      </div>

      <SkillFields values={form} onChange={change} unsaved={bodyChanged} />
      {bodyChanged && (
        <FormField label={t("config.versionNote")} hint={t("config.versionNoteHint")}>
          <TextInput
            aria-label={t("config.versionNote")}
            value={versionNote}
            onChange={setVersionNote}
            maxLength={SKILL_VERSION_NOTE_MAX}
            placeholder={t("config.versionNotePlaceholder")}
          />
        </FormField>
      )}

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={!dirty || invalid || update.isPending}>
          {update.isPending ? t("config.saving") : t("config.save")}
        </Button>
        <Button
          kind="secondary"
          onClick={() => {
            setForm(toFormValues(skill));
            setVersionNote("");
          }}
          disabled={!dirty || update.isPending}
        >
          {t("config.cancel")}
        </Button>
      </div>
      {bodyChanged && <div style={s.snapshotNote}>{t("config.snapshotNote", { version: skill.version + 1 })}</div>}

      <div style={s.danger}>
        <span style={s.dangerTitle}>{t("config.dangerTitle")}</span>
        <Button kind="danger" icon="Trash" onClick={handleDelete} disabled={remove.isPending}>
          {remove.isPending ? t("config.deleting") : t("config.deleteSkill")}
        </Button>
      </div>
    </div>
  );
}
